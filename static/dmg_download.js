// /static/dmg_download.js
class DMGDownloader {
    constructor() {
        this.downloadItems = {};
        this.isListCollapsed = false;
        this.retryCount = 0;
        this.maxRetries = 3;
        this.initEventListeners();
        this.loadDMGList();
    }

    async loadDMGList(force = false) {
        const container = document.getElementById('download-container');
        if (!container) return;
        
        try {
            // 添加刷新状态
            const refreshBtn = document.querySelector('.refresh-btn');
            if (refreshBtn) {
                refreshBtn.classList.add('refreshing');
                refreshBtn.disabled = true;
            }
            
            // 添加列表加载效果
            const listContainer = container.querySelector('.dmg-list-container');
            if (listContainer) {
                listContainer.classList.add('refreshing');
            } else {
                // 骨架屏加载效果
                container.innerHTML = `
                    <div class="dmg-list-container refreshing">
                        ${Array(3).fill().map(() => `
                            <div class="dmg-item loading-skeleton" style="height: 80px; background: var(--card-color); border-radius: var(--border-radius); margin-bottom: 15px;"></div>
                        `).join('')}
                    </div>
                `;
            }
            
            // 延迟以展示动画
            await new Promise(resolve => setTimeout(resolve, 300));
            
            const url = `/api/dmg-list?t=${force ? Date.now() : ''}`;
            const response = await fetch(url);
            
            if (!response.ok) throw new Error(`HTTP错误 ${response.status}`);
            
            const data = await response.json();
            if (data.status !== 'success') throw new Error(data.message || '获取列表失败');
            
            // 渲染前添加短暂延迟让动画更自然
            await new Promise(resolve => setTimeout(resolve, 200));
            this.renderDMGList(data.data);
            
        } catch (error) {
            console.error('加载失败:', error);
            this.showError(error.message);
        } finally {
            // 移除刷新状态
            const refreshBtn = document.querySelector('.refresh-btn');
            if (refreshBtn) {
                refreshBtn.classList.remove('refreshing');
                refreshBtn.disabled = false;
                
                // 添加完成动画
                refreshBtn.querySelector('i').style.transform = 'rotate(360deg)';
                setTimeout(() => {
                    refreshBtn.querySelector('i').style.transform = '';
                }, 300);
            }
            
            // 移除列表加载状态
            const listContainer = container.querySelector('.dmg-list-container');
            if (listContainer) {
                listContainer.classList.remove('refreshing');
            }
        }
    }

    showError(message) {
        const container = document.getElementById('download-container');
        if (container) {
            container.innerHTML = `
                <div class="error-placeholder">
                    <i class="fas fa-exclamation-triangle"></i> ${message}
                    <button class="btn btn-outline retry-btn" style="margin-top: 10px;">
                        <i class="fas fa-sync-alt"></i> 重试
                    </button>
                </div>
            `;
            
            const retryBtn = container.querySelector('.retry-btn');
            if (retryBtn) {
                retryBtn.addEventListener('click', () => this.loadDMGList(true));
            }
        }
    }

    renderDMGList(dmgs) {
        const container = document.getElementById('download-container');
        if (!container) return;
        
        if (!dmgs || dmgs.length === 0) {
            container.innerHTML = `
                <div class="empty-placeholder">
                    <i class="fas fa-box-open"></i>
                    <p>当前没有可用的镜像</p>
                    <button class="btn btn-outline retry-btn" style="margin-top: 10px;">
                        <i class="fas fa-sync-alt"></i> 刷新列表
                    </button>
                </div>
            `;
            
            const retryBtn = container.querySelector('.retry-btn');
            if (retryBtn) {
                retryBtn.addEventListener('click', () => this.loadDMGList(true));
            }
            return;
        }
        
        container.innerHTML = `
            <div class="dmg-list-container ${this.isListCollapsed ? 'collapsed' : ''}">
                ${dmgs.map(dmg => `
                    <div class="dmg-item">
                        <div class="dmg-info">
                            <h4>${dmg.title} ${dmg.version}</h4>
                            <div class="dmg-meta">
                                <span>构建版本: ${dmg.build}</span>
                                <span>大小: ${dmg.size}</span>
                                <span>发布日期: ${dmg.releaseDate}</span>
                            </div>
                        </div>
                        <div class="dmg-actions">
                            <button class="btn btn-outline copy-btn" data-url="${encodeURIComponent(dmg.downloadUrl)}">
                                <i class="fas fa-copy"></i> 复制链接
                            </button>
                            <button class="btn btn-primary download-btn" 
                                    data-url="${encodeURIComponent(dmg.downloadUrl)}"
                                    data-filename="${dmg.title.replace(/\s+/g, '_')}_${dmg.version}.dmg">
                                <i class="fas fa-download"></i> 下载
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
            <button class="toggle-list-btn ${this.isListCollapsed ? 'collapsed' : ''}">
                <span>${this.isListCollapsed ? '展开全部' : '折叠列表'}</span>
                <i class="fas fa-chevron-up"></i>
            </button>
        `;
        
        // 重新绑定事件
        this.initCopyButtons();
        this.initToggleButton();
    }

    initCopyButtons() {
        document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const url = decodeURIComponent(e.currentTarget.getAttribute('data-url'));
                try {
                    await navigator.clipboard.writeText(url);
                    showToast('下载链接已复制到剪贴板', 'success');
                } catch (error) {
                    console.error('复制链接失败:', error);
                    showToast('复制链接失败', 'error');
                }
            });
        });
    }

    initToggleButton() {
        const toggleBtn = document.querySelector('.toggle-list-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                this.isListCollapsed = !this.isListCollapsed;
                const container = document.querySelector('.dmg-list-container');
                const icon = toggleBtn.querySelector('i');
                
                if (container) {
                    container.classList.toggle('collapsed', this.isListCollapsed);
                }
                
                toggleBtn.classList.toggle('collapsed', this.isListCollapsed);
                toggleBtn.querySelector('span').textContent = 
                    this.isListCollapsed ? '展开全部' : '折叠列表';
                
                if (icon) {
                    icon.style.transform = this.isListCollapsed ? 'rotate(180deg)' : 'rotate(0)';
                }
            });
        }
    }

    async refreshList() {
        const refreshBtn = document.querySelector('.refresh-btn');
        try {
            if (refreshBtn) {
                refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 刷新中...';
                refreshBtn.style.pointerEvents = 'none';
            }
            
            await this.loadDMGList(true);
            this.retryCount = 0;
            
        } catch (error) {
            console.error('刷新失败:', error);
            if (this.retryCount < this.maxRetries) {
                this.retryCount++;
                setTimeout(() => this.refreshList(), 1000);
            } else {
                showToast('刷新失败，请检查网络连接', 'error');
            }
        } finally {
            if (refreshBtn) {
                refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> 刷新';
                refreshBtn.style.pointerEvents = 'auto';
            }
        }
    }

    initEventListeners() {
        document.querySelector('body').addEventListener('click', (e) => {
            if (e.target.closest('.refresh-btn')) {
                this.refreshList();
            }
        });
        document.addEventListener('DOMContentLoaded', () => {
            this.initCopyButtons();
            this.initToggleButton();
        });
    }
}

// 初始化下载器
document.addEventListener('DOMContentLoaded', () => {
    window.dmgDownloader = new DMGDownloader();
});