// 全局状态更新
const appState = {
    initialized: false,
    colorThemes: [
        { primary: '#3a7bd5', secondary: '#00d2ff', name: '蓝色渐变' },
        { primary: '#8E2DE2', secondary: '#4A00E0', name: '紫色渐变' },
        { primary: '#f12711', secondary: '#f5af19', name: '橙红渐变' },
        { primary: '#11998e', secondary: '#38ef7d', name: '绿色渐变' },
        { primary: '#c31432', secondary: '#240b36', name: '深红渐变' }
    ],
    markedLoaded: false,
    updateCheckInProgress: false,
    updateChecked: false
};

// 在initializeApp中添加marked.js加载
async function initializeApp() {
    if (appState.initialized) return;
    
    try {
        await loadMarked();
        await applyPreferences();
        setupEventListeners();
        
        // 只在初始化时检查一次更新
        if (document.getElementById('auto-update-toggle').checked) {
            setTimeout(checkForUpdates, 3000); // 延迟3秒检查
        }
        
        appState.initialized = true;
        showToast('应用已准备就绪', 'success');
    } catch (error) {
        console.error('应用初始化失败:', error);
        showToast('初始化失败: ' + error.message, 'error');
    }
}

// 加载marked.js
function loadMarked() {
    return new Promise((resolve, reject) => {
        if (appState.markedLoaded) return resolve();
        
        const script = document.createElement('script');
        script.src = '/static/marked.min.js';
        script.onload = () => {
            appState.markedLoaded = true;
            resolve();
        };
        script.onerror = () => reject(new Error('Failed to load marked.js'));
        document.head.appendChild(script);
    });
}


// 应用偏好设置
async function applyPreferences() {
    const prefs = await loadPreferences();
    
    // 应用自动更新设置
    document.getElementById('auto-update-toggle').checked = prefs.autoUpdateCheck;
    
    // 应用主题颜色
    if (prefs.themeColor) {
        try {
            const theme = JSON.parse(prefs.themeColor);
            applyThemeColor(theme);
            
            // 标记当前选中的颜色
            document.querySelectorAll('.color-picker div').forEach((div, index) => {
                if (appState.colorThemes[index].primary === theme.primary && 
                    appState.colorThemes[index].secondary === theme.secondary) {
                    div.classList.add('selected');
                }
            });
        } catch (e) {
            console.error('解析主题颜色失败:', e);
        }
    }
    
    // 应用主题模式
    changeThemeMode(prefs.themeMode);
    document.querySelector(`input[name="theme"][value="${prefs.themeMode}"]`).checked = true;
    
    // 应用开关状态
    document.getElementById('animation-toggle').checked = prefs.animationsEnabled;
    document.getElementById('auto-update-toggle').checked = prefs.autoUpdateCheck;
    document.getElementById('developer-mode-toggle').checked = prefs.developerMode;
    
    // 应用开发者模式
    if (prefs.developerMode) {
        document.body.classList.add('developer-mode');
    }
    
    // 恢复单选按钮状态
    restoreRadioSelections(prefs.radioGroups);
    updateAnimations(prefs.animationsEnabled);
}

// 加载偏好设置
async function loadPreferences() {
    try {
        const response = await fetch('/api/preferences');
        if (!response.ok) throw new Error('加载失败');
        
        const prefs = await response.json();
        
        // 验证并返回规范化设置
        return {
            themeColor: prefs.themeColor || null,
            themeMode: ['light', 'dark', 'system'].includes(prefs.themeMode) ? prefs.themeMode : 'system',
            animationsEnabled: Boolean(prefs.animationsEnabled),
            autoUpdateCheck: Boolean(prefs.autoUpdateCheck),
            developerMode: Boolean(prefs.developerMode),
            radioGroups: prefs.radioGroups || {}
        };
    } catch (error) {
        console.error('加载偏好设置失败:', error);
        // 返回默认设置
        return {
            themeColor: null,
            themeMode: 'system',
            animationsEnabled: true,
            autoUpdateCheck: true,
            developerMode: false,
            radioGroups: {}
        };
    }
}

// 切换主题颜色
function changeThemeColor(index) {
    const theme = appState.colorThemes[index];
    applyThemeColor(theme);
    
    // 更新选中状态
    document.querySelectorAll('.color-picker div').forEach(div => {
        div.classList.remove('selected');
    });
    document.querySelectorAll('.color-picker div')[index].classList.add('selected');
    
    // 保存设置
    savePreferences({
        themeColor: JSON.stringify(theme),
        themeMode: localStorage.getItem('themeMode') || 'system',
        animationsEnabled: document.getElementById('animation-toggle').checked,
        autoUpdateCheck: document.getElementById('auto-update-toggle').checked,
        developerMode: document.getElementById('developer-mode-toggle').checked,
        radioGroups: saveAllRadioSelections()
    });
}

// 应用主题颜色
function applyThemeColor(theme) {
    document.documentElement.style.setProperty('--primary-color', theme.primary);
    document.documentElement.style.setProperty('--secondary-color', theme.secondary);
    
    // 修复logo文字渐变背景
    const logoText = document.querySelector('.logo h1');
    if (logoText) {
        logoText.style.background = `linear-gradient(to right, ${theme.primary}, ${theme.secondary})`;
        logoText.style.webkitBackgroundClip = 'text';
        logoText.style.webkitTextFillColor = 'transparent';
    }
}

// 切换主题模式
function changeThemeMode(mode) {
    // 验证模式
    if (!['light', 'dark', 'system'].includes(mode)) {
        console.error(`无效的主题模式: ${mode}`);
        mode = 'system';
    }
    
    // 移除所有主题类
    document.body.classList.remove('dark-mode', 'light-mode');
    
    // 应用模式
    if (mode === 'dark') {
        document.body.classList.add('dark-mode');
        updateDarkModeVariables();
    } else if (mode === 'light') {
        document.body.classList.add('light-mode');
        updateLightModeVariables();
    } else {
        // 系统默认
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            changeThemeMode('dark');
        } else {
            changeThemeMode('light');
        }
    }
    
    localStorage.setItem('themeMode', mode);
}

// 更新暗色模式CSS变量
function updateDarkModeVariables() {
    document.documentElement.style.setProperty('--bg-color', '#1a1a1a');
    document.documentElement.style.setProperty('--card-color', '#2a2a2a');
    document.documentElement.style.setProperty('--text-color', '#ffffff');
    document.documentElement.style.setProperty('--text-light', '#aaaaaa');
    document.documentElement.style.setProperty('--sidebar-color', '#1a1a1a');
}

// 更新亮色模式CSS变量
function updateLightModeVariables() {
    document.documentElement.style.setProperty('--bg-color', '#f8f9fa');
    document.documentElement.style.setProperty('--card-color', '#ffffff');
    document.documentElement.style.setProperty('--text-color', '#333333');
    document.documentElement.style.setProperty('--text-light', '#6c757d');
    document.documentElement.style.setProperty('--sidebar-color', '#2a2e35');
}

// 更新动画设置
function updateAnimations(enabled) {
    if (enabled) {
        document.documentElement.style.setProperty('--transition', 'all 0.3s ease');
        document.body.classList.remove('no-animations');
    } else {
        document.documentElement.style.setProperty('--transition', 'none');
        document.body.classList.add('no-animations');
    }
}

// 保存偏好设置
async function savePreferences(prefs) {
    try {
        const response = await fetch('/api/preferences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(prefs)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || '保存失败');
        }
        
        showToast('设置已保存', 'success');
    } catch (error) {
        console.error('保存设置出错:', error);
        showToast(`保存失败: ${error.message}`, 'error');
    }
}

// 保存所有单选按钮状态
function saveAllRadioSelections() {
    const radioGroups = {};
    
    document.querySelectorAll('input[type="radio"]').forEach(radio => {
        if (!radioGroups[radio.name]) {
            radioGroups[radio.name] = document.querySelector(
                `input[name="${radio.name}"]:checked`)?.value || null;
        }
    });
    
    return radioGroups;
}

// 恢复单选按钮状态
function restoreRadioSelections(radioGroups) {
    for (const [groupName, value] of Object.entries(radioGroups)) {
        if (value) {
            const radio = document.querySelector(
                `input[name="${groupName}"][value="${value}"]`);
            if (radio) radio.checked = true;
        }
    }
}

// 设置事件监听器
function setupEventListeners() {
    // 检查更新按钮
    const checkUpdateBtnNew = document.getElementById('check-update-btn');
    if (checkUpdateBtnNew) {
        checkUpdateBtnNew.addEventListener('click', checkForUpdates);
    }

    document.querySelectorAll('.color-picker div').forEach((div, index) => {
        div.addEventListener('click', () => {
            changeThemeColor(index);
        });
    });
    
    // 主题模式选择器
    document.querySelectorAll('input[name="theme"]').forEach(radio => {
        radio.addEventListener('change', () => {
            changeThemeMode(radio.value);
            savePreferences({
                themeMode: radio.value,
                themeColor: localStorage.getItem('themeColor'),
                animationsEnabled: document.getElementById('animation-toggle').checked,
                autoUpdateCheck: document.getElementById('auto-update-toggle').checked,
                developerMode: document.getElementById('developer-mode-toggle').checked,
                radioGroups: saveAllRadioSelections()
            });
        });
    });
    
    // 动画开关
    const animationToggle = document.getElementById('animation-toggle');
    if (animationToggle) {
        animationToggle.addEventListener('change', function() {
            updateAnimations(this.checked);
            savePreferences({
                animationsEnabled: this.checked,
                themeMode: localStorage.getItem('themeMode') || 'system',
                themeColor: localStorage.getItem('themeColor'),
                autoUpdateCheck: document.getElementById('auto-update-toggle').checked,
                developerMode: document.getElementById('developer-mode-toggle').checked,
                radioGroups: saveAllRadioSelections()
            });
        });
    }

    
    // 开发者模式切换
    const devModeToggle = document.getElementById('developer-mode-toggle');
    if (devModeToggle) {
        devModeToggle.addEventListener('change', function() {
            document.body.classList.toggle('developer-mode', this.checked);
            savePreferences({
                developerMode: this.checked,
                themeMode: localStorage.getItem('themeMode') || 'system',
                themeColor: localStorage.getItem('themeColor'),
                animationsEnabled: document.getElementById('animation-toggle').checked,
                autoUpdateCheck: document.getElementById('auto-update-toggle').checked,
                radioGroups: saveAllRadioSelections()
            });
        });
    }
    
    // 自动更新开关
    const autoUpdateToggle = document.getElementById('auto-update-toggle');
    if (autoUpdateToggle) {
        autoUpdateToggle.addEventListener('change', function() {
            savePreferences({
                autoUpdateCheck: this.checked,
                themeMode: localStorage.getItem('themeMode') || 'system',
                themeColor: localStorage.getItem('themeColor'),
                animationsEnabled: document.getElementById('animation-toggle').checked,
                developerMode: document.getElementById('developer-mode-toggle').checked,
                radioGroups: saveAllRadioSelections()
            });
        });
    }
    
    // 单选按钮
    document.querySelectorAll('input[type="radio"]').forEach(radio => {
        radio.addEventListener('change', () => {
            savePreferences({
                radioGroups: saveAllRadioSelections(),
                themeMode: localStorage.getItem('themeMode') || 'system',
                themeColor: localStorage.getItem('themeColor'),
                animationsEnabled: document.getElementById('animation-toggle').checked,
                autoUpdateCheck: document.getElementById('auto-update-toggle').checked,
                developerMode: document.getElementById('developer-mode-toggle').checked
            });
        });
    });
    
    // 检查更新按钮
    const checkUpdateBtn = document.getElementById('check-update-btn');
    if (checkUpdateBtn) {
        checkUpdateBtn.addEventListener('click', checkForUpdates);
    }
}

// 检查更新
async function checkForUpdates() {
    // 防止重复检查
    if (appState.updateCheckInProgress) return;
    appState.updateCheckInProgress = true;
    
    const btn = document.getElementById('check-update-btn');
    const currentVersion = document.querySelector('#current-version').textContent.trim();
    
    try {
        // 更新按钮状态
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 检查中...';
        }

        const response = await fetch('/api/check-update');
        if (!response.ok) throw new Error(`HTTP错误 ${response.status}`);

        const data = await response.json();
        if (!data.latestVersion) throw new Error('无效的更新数据');

        const currentVersionNum = currentVersion.replace('v', '').trim();
        const latestVersionNum = data.latestVersion.replace('v', '').trim();
        
        if (latestVersionNum !== currentVersionNum) {
            document.querySelectorAll('.version-badge').forEach(badge => {
                badge.textContent = `新版本 v${data.latestVersion}`;
                badge.style.display = 'inline-flex';
                badge.onclick = (e) => {
                    e.stopPropagation();
                    showUpdateModal(data);
                };
            });
            showToast(`发现新版本 v${data.latestVersion}`, 'success');
        } else {
            showToast('当前已是最新版本', 'success');
        }
        
    } catch (error) {
        console.error('检查更新失败:', error);
        showToast(`更新检查失败: ${error.message}`, 'error');
    } finally {
        appState.updateCheckInProgress = false;
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sync-alt"></i> 检查更新';
        }
    }
}


// 支持Markdown的更新模态框
function showUpdateModal(data) {
    if (!window.marked) {
        showToast('Markdown解析器加载失败', 'error');
        return;
    }

    const releaseNotes = data.releaseNotes || '暂无更新说明';
    const parsedNotes = marked.parse(releaseNotes);

    const modalContent = `
        <div class="update-modal">
            <h3>发现新版本 v${data.latestVersion}</h3>
            <p class="release-date">发布日期：${data.releaseDate || '未知'}</p>
            <div class="release-notes">${parsedNotes}</div>
            <div class="modal-actions">
                <button class="btn btn-outline cancel-btn">稍后再说</button>
                <button class="btn btn-primary confirm-btn">立即更新</button>
            </div>
        </div>
    `;

    const modal = document.createElement('div');
    modal.className = 'update-modal-overlay';
    modal.innerHTML = modalContent;
    document.body.appendChild(modal);

    // 强制重绘以触发动画
    setTimeout(() => {
        modal.style.opacity = '1';
        const modalContent = modal.querySelector('.update-modal');
        if (modalContent) modalContent.style.opacity = '1';
    }, 10);

    modal.querySelector('.cancel-btn').onclick = () => {
        if (document.body.classList.contains('no-animations')) {
            modal.remove();
        } else {
            modal.style.opacity = '0';
            modal.querySelector('.update-modal').style.transform = 'translateY(50px) scale(0.95)';
            setTimeout(() => modal.remove(), 300);
        }
    };

    modal.querySelector('.confirm-btn').onclick = () => {
        window.open(data.downloadUrl, '_blank');
        if (document.body.classList.contains('no-animations')) {
            modal.remove();
        } else {
            modal.style.opacity = '0';
            modal.querySelector('.update-modal').style.transform = 'translateY(50px) scale(0.95)';
            setTimeout(() => modal.remove(), 300);
        }
    };
}

// 新增更新弹窗函数
function showUpdateModal(data) {
    if (!window.marked) {
        showToast('Markdown解析器加载失败', 'error');
        return;
    }

    const releaseNotes = data.releaseNotes || '暂无更新说明';
    const parsedNotes = marked.parse(releaseNotes);

    const modal = document.createElement('div');
    modal.className = 'update-modal-overlay';
    modal.innerHTML = `
        <div class="update-modal">
            <h3>发现新版本 v${data.latestVersion}</h3>
            <p class="release-date">发布日期：${data.releaseDate || '未知'}</p>
            <div class="release-notes">${parsedNotes}</div>
            <div class="modal-actions">
                <button class="btn btn-outline cancel-btn">稍后再说</button>
                <button class="btn btn-primary confirm-btn">立即更新</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);

    // 显示动画
    setTimeout(() => {
        modal.style.opacity = '1';
        const modalContent = modal.querySelector('.update-modal');
        modalContent.style.opacity = '1';
    }, 10);

    // 添加图片点击放大功能
    setTimeout(() => {
        const images = modal.querySelectorAll('.release-notes img');
        images.forEach(img => {
            img.addEventListener('click', function() {
                showImageZoom(this.src);
            });
        });
    }, 100); // 稍延迟确保DOM加载完成

    // 关闭模态框函数
    const closeModal = () => {
        if (document.body.classList.contains('no-animations')) {
            modal.remove();
        } else {
            modal.classList.add('closing');
            modal.querySelector('.update-modal').classList.add('closing');
            
            // 动画结束后移除元素
            setTimeout(() => {
                modal.remove();
            }, 300); // 匹配动画持续时间
        }
    };

    // 取消按钮事件
    modal.querySelector('.cancel-btn').onclick = closeModal;
    
    // 确认按钮事件
    modal.querySelector('.confirm-btn').onclick = () => {
        window.open(data.downloadUrl, '_blank');
        closeModal();
    };
    
    // 点击背景关闭
    modal.onclick = (e) => {
        if (e.target === modal) {
            closeModal();
        }
    };
}

// 图片放大查看功能
function showImageZoom(src) {
    const overlay = document.createElement('div');
    overlay.className = 'image-viewer-overlay';
    overlay.innerHTML = `
    <div class="image-viewer-content">
        <img src="${src}" alt="放大图片">
        <button class="image-viewer-close" title="关闭" aria-label="关闭图片"></button>
    </div>
`;
    
    document.body.appendChild(overlay);
    
    // 显示动画
    setTimeout(() => {
        overlay.classList.add('showing');
        const content = overlay.querySelector('.image-viewer-content');
        content.classList.add('showing');
    }, 10);
    
    // 关闭函数
    const closeViewer = () => {
        if (document.body.classList.contains('no-animations')) {
            overlay.remove();
        } else {
            overlay.classList.remove('showing');
            overlay.classList.add('closing');
            const content = overlay.querySelector('.image-viewer-content');
            content.classList.remove('showing');
            content.classList.add('closing');
            
            // 动画结束后移除元素
            setTimeout(() => {
                overlay.remove();
            }, 300); // 匹配动画持续时间
        }
    };
    
    // 关闭按钮事件
    overlay.querySelector('.image-viewer-close').onclick = closeViewer;
    
    // 点击背景关闭
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            closeViewer();
        }
    };
    
    // ESC键关闭
    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            closeViewer();
            document.removeEventListener('keydown', handleKeyDown);
        }
    };
    document.addEventListener('keydown', handleKeyDown);
}

// 显示Toast通知
function showToast(message, type = 'info') {
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// 切换不同部分
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    document.getElementById(sectionId).classList.add('active');
    document.querySelector(`.nav-item[onclick="showSection('${sectionId}')"]`).classList.add('active');
}

// 模拟USB端口检测
function detectUsbPorts() {
    const portsContainer = document.getElementById('usb-ports');
    portsContainer.innerHTML = `
        <div style="background-color: #f8f9fa; border-radius: 8px; padding: 15px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div>
                    <strong>USB 3.0 Port (HS01)</strong>
                    <div style="font-size: 12px; color: var(--text-light);">XHCI控制器</div>
                </div>
                <label class="switch">
                    <input type="checkbox" checked>
                    <span class="slider round"></span>
                </label>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div>
                    <strong>USB 3.0 Port (HS02)</strong>
                    <div style="font-size: 12px; color: var(--text-light);">XHCI控制器</div>
                </div>
                <label class="switch">
                    <input type="checkbox" checked>
                    <span class="slider round"></span>
                </label>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div>
                    <strong>USB 2.0 Port (HS03)</strong>
                    <div style="font-size: 12px; color: var(--text-light);">EHCI控制器</div>
                </div>
                <label class="switch">
                    <input type="checkbox">
                    <span class="slider round"></span>
                </label>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong>USB Type-C Port (HS04)</strong>
                    <div style="font-size: 12px; color: var(--text-light);">XHCI控制器</div>
                </div>
                <label class="switch">
                    <input type="checkbox" checked>
                    <span class="slider round"></span>
                </label>
            </div>
        </div>
        <p style="margin-top: 15px; font-size: 12px; color: var(--text-light);">已检测到4个USB端口，建议启用不超过15个端口以获得最佳兼容性。</p>
    `;
}

// 启动应用
document.addEventListener('DOMContentLoaded', initializeApp);