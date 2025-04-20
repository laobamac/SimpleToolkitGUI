// /static/download_handle.js
class DownloadManager {
    constructor() {
        this.activeDownloads = new Map();
        this.activeButtons = new Map();
        this.initEventListeners();
        this._checkAPIReady();
    }

    initEventListeners() {
        // 下载按钮点击事件
        document.addEventListener('click', async (e) => {
            if (e.target.closest('.download-btn')) {
                const btn = e.target.closest('.download-btn');
                const url = decodeURIComponent(btn.getAttribute('data-url'));
                const filename = btn.getAttribute('data-filename');
                
                // 分配唯一ID用于状态跟踪
                if (!btn.dataset.downloadId) {
                    btn.dataset.downloadId = `dl-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                }
                
                await this.startDownload(url, filename, btn);
            }

            // 取消下载按钮
            if (e.target.closest('.cancel-download-btn')) {
                const btn = e.target.closest('.cancel-download-btn');
                const downloadId = btn.getAttribute('data-download-id');
                this.cancelDownload(downloadId);
            }

            // 打开文件所在位置
            if (e.target.closest('.open-folder-btn')) {
                const btn = e.target.closest('.open-folder-btn');
                const path = btn.getAttribute('data-path');
                this.openFileLocation(path);
            }

            // 重试按钮
            if (e.target.closest('.retry-download-btn')) {
                const btn = e.target.closest('.retry-download-btn');
                const url = decodeURIComponent(btn.getAttribute('data-url'));
                const filename = btn.getAttribute('data-filename');
                const originalBtn = document.querySelector(`.download-btn[data-filename="${filename}"]`);
                
                await this.startDownload(url, filename, originalBtn || btn);
            }
        });
    }

    async _checkAPIReady() {
        // 等待 pywebview API 加载完成
        return new Promise(resolve => {
            const check = () => {
                if (window.pywebview?.api) {
                    resolve();
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }

    async startDownload(url, filename, btn) {
        await this._checkAPIReady();
        const downloadId = btn?.dataset.downloadId || `dl-${Date.now()}`;
        
        try {
            // 设置按钮为加载状态
            this._setButtonState(btn, 'loading', '准备下载...');

            // 步骤1: 选择保存路径
            const savePath = await this._selectSavePathWithRetry(filename);
            if (!savePath) {
                this._setButtonState(btn, 'idle');
                showToast('下载已取消', 'info');
                return;
            }

            // 步骤2: 验证路径可写性
            try {
                await this._verifyPathWritable(savePath);
            } catch (error) {
                this._setButtonState(btn, 'error', '路径无效');
                const result = await this._showPathErrorDialog(error.message);
                
                if (result === 'retry') {
                    return this.startDownload(url, filename, btn);
                } else if (result === 'default') {
                    const defaultPath = await this._getDefaultPath(filename);
                    return this.startDownload(url, filename, btn);
                } else {
                    this._setButtonState(btn, 'idle');
                    return;
                }
            }

            // 步骤3: 开始下载
            this._setButtonState(btn, 'loading', '下载中...');
            
            const response = await fetch('/api/start-download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: url,
                    save_path: savePath,
                    filename: filename
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || '启动下载失败');
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.message || '下载失败');
            }

            // 添加到活动下载列表
            this.activeDownloads.set(data.download_id, {
                btn: btn,
                url: url,
                path: savePath
            });

            // 更新UI
            this.addDownloadItem({
                id: data.download_id,
                filename: filename,
                path: savePath,
                status: 'downloading',
                progress: 0,
                speed: '0 KB/s',
                eta: '--',
                downloaded: 0,
                total_size: 0,
                url: url
            });

        } catch (error) {
            console.error('下载失败:', error);
            this._setButtonState(btn, 'error', '下载失败');
            setTimeout(() => this._setButtonState(btn, 'idle'), 2000);
            showToast(`下载失败: ${error.message}`, 'error');
        }
    }

    async _selectSavePathWithRetry(filename, retries = 2) {
        let lastError;
        
        for (let i = 0; i < retries; i++) {
            try {
                // 确保 pywebview.api 已加载
                if (!window.pywebview || !window.pywebview.api) {
                    await new Promise(resolve => {
                        const check = () => {
                            if (window.pywebview?.api) resolve();
                            else setTimeout(check, 100);
                        };
                        check();
                    });
                }
                
                // 调用暴露的方法
                const savePath = await window.pywebview.api.select_save_path(filename);
                if (savePath) {
                    return savePath;
                }
                return null; // 用户取消
            } catch (error) {
                lastError = error;
                console.error(`路径选择尝试 ${i + 1} 失败:`, error);
                await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
            }
        }
        
        throw lastError || new Error('无法打开文件对话框');
    }

    async _verifyPathWritable(path) {
        try {
            const response = await fetch('/api/verify-path', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: path })
            });
            
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.message || '路径验证失败');
            }
            return true;
        } catch (error) {
            console.error('路径验证失败:', error);
            throw new Error(`无法写入选定位置: ${error.message}`);
        }
    }

    async _getDefaultPath(filename) {
        try {
            const downloadsDir = await pywebview.api.get_downloads_dir();
            const safeName = this._sanitizeFilename(filename);
            return `${downloadsDir}/${safeName}`;
        } catch (error) {
            console.error('获取默认路径失败:', error);
            return `${this._sanitizeFilename(filename)}`;
        }
    }

    _sanitizeFilename(filename) {
        // 移除非法字符，保留中文、字母、数字和常用符号
        return filename.replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
                      .replace(/[\s]+/g, '_')
                      .substring(0, 255);
    }

    async _showPathErrorDialog(message) {
        return new Promise((resolve) => {
            const dialog = document.createElement('div');
            dialog.className = 'download-error-dialog';
            dialog.innerHTML = `
                <div class="dialog-content">
                    <div class="dialog-header">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h3>路径选择失败</h3>
                    </div>
                    <div class="dialog-body">
                        <p>${message}</p>
                        <div class="suggestions">
                            <p><strong>建议解决方案：</strong></p>
                            <ul>
                                <li>选择不同的文件夹</li>
                                <li>检查文件夹写入权限</li>
                                <li>关闭可能拦截的防病毒软件</li>
                            </ul>
                        </div>
                    </div>
                    <div class="dialog-footer">
                        <button class="btn btn-outline cancel-btn">取消</button>
                        <button class="btn btn-primary retry-btn">重试</button>
                        <button class="btn btn-outline default-btn">使用默认路径</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(dialog);
            
            // 动画显示
            setTimeout(() => {
                dialog.classList.add('visible');
            }, 10);
            
            // 按钮事件
            dialog.querySelector('.cancel-btn').onclick = () => {
                dialog.classList.remove('visible');
                setTimeout(() => dialog.remove(), 300);
                resolve('cancel');
            };
            
            dialog.querySelector('.retry-btn').onclick = () => {
                dialog.classList.remove('visible');
                setTimeout(() => dialog.remove(), 300);
                resolve('retry');
            };
            
            dialog.querySelector('.default-btn').onclick = () => {
                dialog.classList.remove('visible');
                setTimeout(() => dialog.remove(), 300);
                resolve('default');
            };
        });
    }

    _setButtonState(btn, state, text = null) {
        if (!btn) return;
        
        // 保存原始状态
        if (!this.activeButtons.has(btn.dataset.downloadId)) {
            this.activeButtons.set(btn.dataset.downloadId, {
                originalHtml: btn.innerHTML,
                originalText: btn.textContent.trim(),
                originalClass: btn.className
            });
        }
        
        const btnStates = {
            loading: {
                html: `<i class="fas fa-spinner fa-spin"></i> ${text || '处理中...'}`,
                disabled: true,
                class: 'btn-loading'
            },
            error: {
                html: `<i class="fas fa-exclamation-circle"></i> ${text || '错误'}`,
                disabled: true,
                class: 'btn-error'
            },
            idle: {
                html: this.activeButtons.get(btn.dataset.downloadId)?.originalHtml || '',
                disabled: false,
                class: this.activeButtons.get(btn.dataset.downloadId)?.originalClass || ''
            }
        };
        
        const currentState = btnStates[state] || btnStates.idle;
        
        // 应用状态变化
        btn.innerHTML = currentState.html;
        btn.disabled = currentState.disabled;
        
        // 清理旧状态类
        btn.classList.remove('btn-loading', 'btn-error');
        
        // 添加新状态类
        if (currentState.class) {
            btn.classList.add(currentState.class);
        }
        
        // 添加微交互动画
        if (state === 'error') {
            btn.style.transform = 'scale(1.05)';
            setTimeout(() => {
                btn.style.transform = '';
            }, 300);
        }
    }

    addDownloadItem(download) {
        const downloadsList = document.getElementById('downloads-list');
        if (!downloadsList) return;

        // 移除空状态提示（如果存在）
        if (downloadsList.querySelector('.empty-message')) {
            downloadsList.innerHTML = '';
        }

        // 创建或更新下载项
        let item = document.getElementById(`download-${download.id}`);
        if (!item) {
            item = document.createElement('div');
            item.className = 'download-item';
            item.id = `download-${download.id}`;
            downloadsList.prepend(item); // 添加到列表顶部
        }

        // 动画效果
        item.style.opacity = '0';
        item.style.transform = 'translateY(10px)';
        
        item.innerHTML = this._getDownloadItemHTML(download);
        
        // 触发动画
        setTimeout(() => {
            item.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            item.style.opacity = '1';
            item.style.transform = 'translateY(0)';
        }, 10);
    }

    _getDownloadItemHTML(download) {
        const progress = Math.min(100, Math.max(0, download.progress || 0));
        const statusClass = download.status === 'error' ? 'error' : 
                          download.status === 'completed' ? 'completed' : '';
        
        return `
            <div class="download-info ${statusClass}">
                <div class="download-header">
                    <span class="download-filename">${download.filename}</span>
                    <span class="download-status">${download.status === 'downloading' ? '下载中' : 
                                               download.status === 'completed' ? '已完成' : '失败'}</span>
                </div>
                
                <div class="download-path">${download.path}</div>
                
                <div class="download-stats">
                    <span class="download-progress">${progress.toFixed(1)}%</span>
                    <span class="download-speed">${download.speed}</span>
                    <span class="download-eta">剩余: ${download.eta}</span>
                </div>
                
                <div class="progress-container">
                    <div class="download-progress-bar" style="width: ${progress}%"></div>
                </div>
            </div>
            
            <div class="download-actions">
                ${download.status === 'downloading' ? `
                    <button class="btn btn-outline cancel-download-btn" data-download-id="${download.id}">
                        <i class="fas fa-times"></i> 取消
                    </button>
                ` : download.status === 'completed' ? `
                    <button class="btn btn-outline open-folder-btn" data-path="${download.path}">
                        <i class="fas fa-folder-open"></i>
                    </button>
                ` : `
                    <button class="btn btn-outline retry-download-btn" 
                            data-url="${encodeURIComponent(download.url)}"
                            data-filename="${download.filename}">
                        <i class="fas fa-redo"></i> 重试
                    </button>
                `}
            </div>
        `;
    }

    cancelDownload(downloadId) {
        const download = this.activeDownloads.get(downloadId);
        if (download) {
            this._setButtonState(download.btn, 'idle');
        }
        
        fetch('/api/cancel-download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ download_id: downloadId })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showToast('下载已取消', 'info');
                const item = document.getElementById(`download-${downloadId}`);
                if (item) {
                    item.classList.add('cancelled');
                    const btn = item.querySelector('.cancel-download-btn');
                    if (btn) btn.disabled = true;
                }
            }
        })
        .catch(error => {
            console.error('取消下载失败:', error);
            showToast('取消下载失败', 'error');
        });
    }

    openFileLocation(path) {
        try {
            pywebview.api.open_file_location(path);
        } catch (error) {
            console.error('打开文件位置失败:', error);
            showToast('无法打开文件位置', 'error');
        }
    }
}

// 初始化下载管理器
document.addEventListener('DOMContentLoaded', () => {
    window.downloadManager = new DownloadManager();
});

// 供Python调用的更新下载项函数
function updateDownloadItem(download) {
    if (window.downloadManager) {
        window.downloadManager.addDownloadItem(download);
        
        // 更新关联按钮状态
        const activeDownload = window.downloadManager.activeDownloads.get(download.id);
        if (activeDownload && activeDownload.btn) {
            if (download.status === 'completed') {
                window.downloadManager._setButtonState(activeDownload.btn, 'idle');
            } else if (download.status === 'error') {
                window.downloadManager._setButtonState(activeDownload.btn, 'error', '下载失败');
                setTimeout(() => {
                    window.downloadManager._setButtonState(activeDownload.btn, 'idle');
                }, 2000);
            }
        }
    }
}