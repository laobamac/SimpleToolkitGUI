import webview
import os
import sys
from flask import Flask, render_template_string, send_from_directory, jsonify, request
import json
from pathlib import Path
from flask_cors import CORS
import requests
from download_handle import DownloadManager
from download_handle import DownloadHandler

app = Flask(__name__)
CORS(app, resources={
    r"/checkUpdate": {
        "origins": ["https://your-frontend-domain.com", "http://localhost:*"],
        "methods": ["GET"],
        "allow_headers": ["Content-Type"]
    }
})

PREFERENCES_PATH = Path("C:/SimpleToolkit/preferences.json")

def ensure_preferences_dir():
    """确保目录和文件存在且有效，如果文件损坏则删除并重建"""
    try:
        PREFERENCES_PATH.parent.mkdir(parents=True, exist_ok=True)
        
        # 如果文件不存在，直接创建默认设置
        if not PREFERENCES_PATH.exists():
            return reset_preferences_to_default()
            
        # 验证文件内容是否有效
        try:
            with open(PREFERENCES_PATH, 'r') as f:
                json.load(f)  # 尝试解析验证
            return True
        except (json.JSONDecodeError, IOError) as e:
            print(f"偏好设置文件损坏: {str(e)}")
            # 文件损坏，删除并重建
            try:
                PREFERENCES_PATH.unlink()  # 删除损坏的文件
            except Exception as e:
                print(f"删除损坏的偏好设置文件失败: {str(e)}")
            return reset_preferences_to_default()
            
    except Exception as e:
        print(f"初始化偏好设置目录失败: {str(e)}")
        return reset_preferences_to_default()
    
def reset_preferences_to_default():
    """重置为默认偏好设置，确保创建新文件"""
    default_prefs = {
        'themeColor': None,
        'themeMode': 'system',
        'animationsEnabled': True,
        'autoUpdateCheck': True,
        'developerMode': False,
        'radioGroups': {}
    }
    try:
        with open(PREFERENCES_PATH, 'w') as f:
            json.dump(default_prefs, f, indent=2)
        print("已创建新的默认偏好设置文件")
        return default_prefs
    except Exception as e:
        print(f"创建默认偏好设置文件失败: {str(e)}")
        return default_prefs

def load_preferences():
    """加载并验证偏好设置文件"""
    default_prefs = {
        'themeColor': None,
        'themeMode': 'system',
        'animationsEnabled': True,
        'autoUpdateCheck': True,
        'developerMode': False,
        'radioGroups': {}
    }
    
    try:
        # 确保文件存在
        if not PREFERENCES_PATH.exists():
            save_preferences(default_prefs)
            return default_prefs
        
        # 读取文件
        with open(PREFERENCES_PATH, 'r') as f:
            prefs = json.load(f)
        
        # 验证数据结构
        if not isinstance(prefs, dict):
            raise ValueError("偏好设置必须是字典")
        
        # 验证每个字段
        valid_prefs = {}
        valid_prefs['themeColor'] = prefs.get('themeColor') if isinstance(prefs.get('themeColor'), (str, type(None))) else None
        
        valid_prefs['themeMode'] = prefs.get('themeMode', 'system')
        if valid_prefs['themeMode'] not in ['light', 'dark', 'system']:
            valid_prefs['themeMode'] = 'system'
        
        for bool_key in ['animationsEnabled', 'autoUpdateCheck', 'developerMode']:
            valid_prefs[bool_key] = bool(prefs.get(bool_key, default_prefs[bool_key]))
        
        valid_prefs['radioGroups'] = prefs.get('radioGroups', {})
        if not isinstance(valid_prefs['radioGroups'], dict):
            valid_prefs['radioGroups'] = {}
        
        return valid_prefs
    
    except Exception as e:
        print(f"加载偏好设置出错，使用默认值: {str(e)}")
        return default_prefs


def resource_path(relative_path):
    """获取资源的绝对路径"""
    try:
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

# HTML
HTML = r"""
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SimpleToolkit - 黑苹果工具箱</title>
    <!-- 本地Font Awesome -->
    <link rel="stylesheet" href="/static/fontawesome/all.min.css">
    <!-- 本地CSS -->
    <link rel="stylesheet" href="/static/styles.css">
    <link rel="stylesheet" href="/static/dmg_download.css">
    <script src="/static/dmg_download.js"></script>
    <link rel="stylesheet" href="/static/download_handle.css">
    <script src="/static/download_handle.js"></script>
</head>
<body>
    <!-- 侧边导航栏 -->
    <div class="sidebar">
        <div class="logo">
            <img src="/static/gui_toolkit.ico" alt="Logo">
            <h1>SimpleToolkit</h1>
        </div>
        
        <div class="nav-item active" onclick="showSection('dashboard')">
            <i class="fas fa-home"></i>
            <span>概览</span>
        </div>
        
        <div class="nav-item" onclick="showSection('usb')">
            <svg class="icon" viewBox="0 0 512 512" width="16" height="16">
                <path fill="currentColor" d="M641.5 256c0 3.1-1.7 6.1-4.5 7.5L547.9 317c-1.4 .8-2.8 1.4-4.5 1.4-1.4 0-3.1-.3-4.5-1.1-2.8-1.7-4.5-4.5-4.5-7.8v-35.6H295.7c25.3 39.6 40.5 106.9 69.6 106.9H392V354c0-5 3.9-8.9 8.9-8.9H490c5 0 8.9 3.9 8.9 8.9v89.1c0 5-3.9 8.9-8.9 8.9h-89.1c-5 0-8.9-3.9-8.9-8.9v-26.7h-26.7c-75.4 0-81.1-142.5-124.7-142.5H140.3c-8.1 30.6-35.9 53.5-69 53.5C32 327.3 0 295.3 0 256s32-71.3 71.3-71.3c33.1 0 61 22.8 69 53.5 39.1 0 43.9 9.5 74.6-60.4C255 88.7 273 95.7 323.8 95.7c7.5-20.9 27-35.6 50.4-35.6 29.5 0 53.5 23.9 53.5 53.5s-23.9 53.5-53.5 53.5c-23.4 0-42.9-14.8-50.4-35.6H294c-29.1 0-44.3 67.4-69.6 106.9h310.1v-35.6c0-3.3 1.7-6.1 4.5-7.8 2.8-1.7 6.4-1.4 8.9 .3l89.1 53.5c2.8 1.1 4.5 4.1 4.5 7.2z"/>
            </svg>
            <span>USB定制</span>
        </div>
        
        <div class="nav-item" onclick="showSection('ssdt')">
            <i class="fas fa-file-code"></i>
            <span>SSDT定制</span>
        </div>
        
        <div class="nav-item" onclick="showSection('download')">
            <i class="fas fa-download"></i>
            <span>镜像下载</span>
        </div>
        
        <div class="nav-item" onclick="showSection('burn')">
            <i class="fas fa-compact-disc"></i>
            <span>镜像烧录</span>
        </div>
        
        <div class="nav-item" onclick="showSection('hardware')">
            <i class="fas fa-microchip"></i>
            <span>硬件信息</span>
        </div>
        
        <div class="nav-item" onclick="showSection('tools')">
            <i class="fas fa-tools"></i>
            <span>实用工具</span>
        </div>
        
        <div class="nav-item" onclick="showSection('settings')">
            <i class="fas fa-cog"></i>
            <span>设置</span>
        </div>
    </div>

    <!-- 主内容区域 -->
    <div class="content">
        <!-- 仪表盘 -->
        <div class="section active" id="dashboard">
            <div class="section-header">
                <h2 class="section-title">概览</h2>
                <div class="version-container">
                    <span class="badge" id="current-version">v1.0.1</span>
                    <span class="version-badge update-badge"></span>
                </div>
            </div>
            <p class="section-description">欢迎使用 SimpleToolkit - 一站式黑苹果工具箱</p>
            
            <div class="grid">
                <div class="card">
                    <h3 class="card-title"><i class="fas fa-rocket"></i>快速开始</h3>
                    <p>选择您需要的功能开始配置您的黑苹果系统</p>
                    <div style="margin-top: 15px;">
                        <button class="btn btn-primary" onclick="showSection('usb')">
                            <svg class="icon usb-icon" viewBox="0 0 512 512" width="16" height="16">
                                <path fill="currentColor" d="M641.5 256c0 3.1-1.7 6.1-4.5 7.5L547.9 317c-1.4 .8-2.8 1.4-4.5 1.4-1.4 0-3.1-.3-4.5-1.1-2.8-1.7-4.5-4.5-4.5-7.8v-35.6H295.7c25.3 39.6 40.5 106.9 69.6 106.9H392V354c0-5 3.9-8.9 8.9-8.9H490c5 0 8.9 3.9 8.9 8.9v89.1c0 5-3.9 8.9-8.9 8.9h-89.1c-5 0-8.9-3.9-8.9-8.9v-26.7h-26.7c-75.4 0-81.1-142.5-124.7-142.5H140.3c-8.1 30.6-35.9 53.5-69 53.5C32 327.3 0 295.3 0 256s32-71.3 71.3-71.3c33.1 0 61 22.8 69 53.5 39.1 0 43.9 9.5 74.6-60.4C255 88.7 273 95.7 323.8 95.7c7.5-20.9 27-35.6 50.4-35.6 29.5 0 53.5 23.9 53.5 53.5s-23.9 53.5-53.5 53.5c-23.4 0-42.9-14.8-50.4-35.6H294c-29.1 0-44.3 67.4-69.6 106.9h310.1v-35.6c0-3.3 1.7-6.1 4.5-7.8 2.8-1.7 6.4-1.4 8.9 .3l89.1 53.5c2.8 1.1 4.5 4.1 4.5 7.2z"/>
                            </svg>
                            USB定制
                        </button>
                        <button class="btn btn-outline" onclick="showSection('ssdt')" style="margin-left: 10px;">
                            <i class="fas fa-file-code"></i> SSDT定制
                        </button>
                    </div>
                </div>
                
                <div class="card">
                    <h3 class="card-title"><i class="fas fa-download"></i>镜像下载</h3>
                    <p>下载最新或历史版本的黑苹果系统镜像</p>
                    <button class="btn btn-primary" onclick="showSection('download')" style="margin-top: 15px;">
                        <i class="fas fa-cloud-download-alt"></i> 前往下载
                    </button>
                </div>
                
                <div class="card">
                    <h3 class="card-title"><i class="fas fa-tasks"></i>系统状态</h3>
                    <div style="margin: 15px 0;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <span>工具完整性</span>
                            <span>100%</span>
                        </div>
                        <div class="progress-container">
                            <div class="progress-bar" style="width: 100%"></div>
                        </div>
                    </div>
                    <div style="margin: 15px 0;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <span>依赖项检查</span>
                            <span>5/5</span>
                        </div>
                        <div class="progress-container">
                            <div class="progress-bar" style="width: 100%"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- USB定制 -->
        <div class="section" id="usb">
            <div class="section-header">
                <h2 class="section-title">USB定制</h2>
            </div>
            <p class="section-description">定制您的USB端口，确保黑苹果系统能正确识别所有USB设备</p>
            
            <div class="card">
                <h3 class="card-title"><i class="fas fa-cogs"></i>USB端口映射</h3>
                <p>检测并映射您的USB端口，生成适合您主板的USB定制文件</p>
                
                <div style="margin-top: 20px;">
                    <button class="btn btn-primary">
                        <i class="fas fa-search"></i> 检测USB端口
                    </button>
                    <button class="btn btn-outline" style="margin-left: 10px;">
                        <i class="fas fa-file-export"></i> 导出配置
                    </button>
                </div>
                
                <div style="margin-top: 20px;">
                    <h4>检测到的USB端口</h4>
                    <div id="usb-ports" style="margin-top: 10px;">
                        <!-- USB端口列表将通过JavaScript动态加载 -->
                        <p style="color: var(--text-light);">点击"检测USB端口"按钮开始扫描</p>
                    </div>
                </div>
            </div>
            
            <div class="card">
                <h3 class="card-title"><i class="fas fa-book"></i>USB定制指南</h3>
                <p>按照以下步骤完成USB定制：</p>
                <ol style="margin-top: 10px; padding-left: 20px;">
                    <li style="margin-bottom: 8px;">连接所有USB设备到不同的端口</li>
                    <li style="margin-bottom: 8px;">点击"检测USB端口"按钮</li>
                    <li style="margin-bottom: 8px;">等待自动检测端口</li>
                    <li style="margin-bottom: 8px;">导出配置并放入EFI文件夹</li>
                </ol>
            </div>
        </div>

        <!-- SSDT定制 -->
        <div class="section" id="ssdt">
            <div class="section-header">
                <h2 class="section-title">SSDT定制</h2>
            </div>
            <p class="section-description">为您的硬件生成定制化的SSDT补丁，解决电源管理、设备兼容性等问题</p>
            
            <div class="grid">
                <div class="card">
                    <h3 class="card-title"><i class="fas fa-bolt"></i>电源管理</h3>
                    <p>生成CPU电源管理相关的SSDT补丁</p>
                    <button class="btn btn-primary" style="margin-top: 15px;">
                        <i class="fas fa-magic"></i> 一键生成
                    </button>
                </div>
                
                <div class="card">
                    <h3 class="card-title"><i class="fas fa-plug"></i>设备补丁</h3>
                    <p>为特定设备生成SSDT补丁</p>
                    <div style="margin-top: 15px;">
                        <select class="form-control" style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid #ddd; margin-bottom: 10px;">
                            <option>选择设备类型</option>
                            <option>USB控制器</option>
                            <option>以太网卡</option>
                            <option>声卡</option>
                            <option>显卡</option>
                        </select>
                        <button class="btn btn-outline" style="width: 100%;">
                            <i class="fas fa-cog"></i> 生成补丁
                        </button>
                    </div>
                </div>
                
                <div class="card">
                    <h3 class="card-title"><i class="fas fa-file-import"></i>导入SSDT</h3>
                    <p>导入已有的SSDT文件进行编辑</p>
                    <button class="btn btn-primary" style="margin-top: 15px;">
                        <i class="fas fa-folder-open"></i> 选择文件
                    </button>
                </div>
            </div>
            
            <div class="card" style="margin-top: 20px;">
                <h3 class="card-title"><i class="fas fa-code"></i>SSDT编辑器</h3>
                <textarea style="width: 100%; height: 300px; padding: 10px; border-radius: 8px; border: 1px solid #ddd; font-family: monospace; resize: vertical;"></textarea>
                <div style="margin-top: 15px; display: flex; justify-content: flex-end;">
                    <button class="btn btn-outline">
                        <i class="fas fa-save"></i> 保存
                    </button>
                    <button class="btn btn-primary" style="margin-left: 10px;">
                        <i class="fas fa-download"></i> 导出
                    </button>
                </div>
            </div>
        </div>

        <!-- 镜像下载 -->
        <div class="section" id="download">
            <div class="section-header">
                <div>
                    <h2 class="section-title">镜像下载</h2>
                    <p class="section-description">下载各种版本的黑苹果系统镜像</p>
                </div>
                <div class="section-header-actions">
                    <button class="refresh-btn">
                        <i class="fas fa-sync-alt"></i> 刷新
                    </button>
                </div>
            </div>
    
            <div class="card">
                <h3 class="card-title"><i class="fas fa-apple-alt"></i>macOS版本</h3>
                <div id="download-container" style="margin-top: 15px;">
                    <!-- 动态加载镜像列表 -->
                    <div class="loading-placeholder">
                        <i class="fas fa-spinner fa-spin"></i> 正在加载镜像列表...
                    </div>
                </div>
            </div>
    
            <div class="card" style="margin-top: 20px;">
                <h3 class="card-title"><i class="fas fa-download"></i>下载队列</h3>
                <div id="downloads-list" class="downloads-list">
                    <!-- 下载项将在这里动态添加 -->
                    <p style="color: var(--text-light); text-align: center;">没有正在进行的下载</p>
                </div>
            </div>
        </div>

        <!-- 镜像烧录 -->
        <div class="section" id="burn">
            <div class="section-header">
                <h2 class="section-title">镜像烧录</h2>
            </div>
            <p class="section-description">将下载的镜像烧录到USB设备，制作安装盘</p>
            
            <div class="grid">
                <div class="card">
                    <h3 class="card-title"><i class="fas fa-file-archive"></i>选择镜像</h3>
                    <div style="margin-top: 15px;">
                        <div style="border: 2px dashed #ddd; border-radius: 8px; padding: 20px; text-align: center; cursor: pointer;">
                            <i class="fas fa-cloud-upload-alt" style="font-size: 24px; color: var(--text-light);"></i>
                            <p style="margin-top: 10px; color: var(--text-light);">点击选择或拖放镜像文件</p>
                            <input type="file" style="display: none;">
                        </div>
                        <p style="margin-top: 10px; font-size: 12px; color: var(--text-light);">支持格式: .dmg, .iso, .img</p>
                    </div>
                </div>
                
                <div class="card">
                    <h3 class="card-title"><i class="fas fa-usb"></i>选择目标设备</h3>
                    <div style="margin-top: 15px;">
                        <select class="form-control" style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid #ddd;">
                            <option>选择USB设备</option>
                            <option>SanDisk Ultra 32GB (F:)</option>
                            <option>Samsung BAR Plus 64GB (G:)</option>
                        </select>
                        <div style="margin-top: 15px;">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                <span>容量</span>
                                <span>28.8 GB 可用 / 32 GB</span>
                            </div>
                            <div class="progress-container">
                                <div class="progress-bar" style="width: 90%"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="card" style="margin-top: 20px;">
                <h3 class="card-title"><i class="fas fa-fire"></i>烧录选项</h3>
                <div style="margin-top: 15px;">
                    <label style="display: flex; align-items: center; margin-bottom: 10px; cursor: pointer;">
                        <input type="checkbox" style="margin-right: 10px;"> 格式化目标设备
                    </label>
                    <label style="display: flex; align-items: center; margin-bottom: 10px; cursor: pointer;">
                        <input type="checkbox" style="margin-right: 10px;"> 验证烧录结果
                    </label>
                    <label style="display: flex; align-items: center; cursor: pointer;">
                        <input type="checkbox" style="margin-right: 10px;"> 添加OpenCore引导
                    </label>
                </div>
                <button class="btn btn-primary" style="margin-top: 20px; width: 100%; padding: 12px;">
                    <i class="fas fa-burn"></i> 开始烧录
                </button>
            </div>
        </div>

        <!-- 硬件信息 -->
        <div class="section" id="hardware">
            <div class="section-header">
                <h2 class="section-title">硬件信息</h2>
            </div>
            <p class="section-description">查看您的硬件配置和兼容性信息</p>
            
            <div class="card">
                <h3 class="card-title"><i class="fas fa-desktop"></i>系统概览</h3>
                <div class="hardware-info" style="margin-top: 15px;">
                    <div class="info-item">
                        <div class="info-label">操作系统</div>
                        <div class="info-value">Windows 11 Pro</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">系统类型</div>
                        <div class="info-value">64位操作系统</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">主板</div>
                        <div class="info-value">ASUS ROG STRIX Z690-E</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">处理器</div>
                        <div class="info-value">Intel Core i9-12900K</div>
                    </div>
                </div>
            </div>
            
            <div class="card" style="margin-top: 20px;">
                <h3 class="card-title"><i class="fas fa-microchip"></i>处理器</h3>
                <div class="hardware-info" style="margin-top: 15px;">
                    <div class="info-item">
                        <div class="info-label">名称</div>
                        <div class="info-value">Intel Core i9-12900K</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">核心数</div>
                        <div class="info-value">16 (8P+8E)</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">线程数</div>
                        <div class="info-value">24</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">基础频率</div>
                        <div class="info-value">3.2 GHz</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">最大频率</div>
                        <div class="info-value">5.2 GHz</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">缓存</div>
                        <div class="info-value">30 MB</div>
                    </div>
                </div>
            </div>
            
            <div class="card" style="margin-top: 20px;">
                <h3 class="card-title"><i class="fas fa-memory"></i>内存</h3>
                <div class="hardware-info" style="margin-top: 15px;">
                    <div class="info-item">
                        <div class="info-label">总容量</div>
                        <div class="info-value">32 GB</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">类型</div>
                        <div class="info-value">DDR5</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">频率</div>
                        <div class="info-value">5200 MHz</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">通道</div>
                        <div class="info-value">双通道</div>
                    </div>
                </div>
            </div>
            
            <div class="card" style="margin-top: 20px;">
                <h3 class="card-title"><i class="fas fa-gamepad"></i>显卡</h3>
                <div class="hardware-info" style="margin-top: 15px;">
                    <div class="info-item">
                        <div class="info-label">主显卡</div>
                        <div class="info-value">NVIDIA GeForce RTX 3080 Ti</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">显存</div>
                        <div class="info-value">12 GB GDDR6X</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">集成显卡</div>
                        <div class="info-value">Intel UHD Graphics 770</div>
                    </div>
                </div>
            </div>
            
            <div class="card" style="margin-top: 20px;">
                <h3 class="card-title"><i class="fas fa-hdd"></i>存储设备</h3>
                <div class="hardware-info" style="margin-top: 15px;">
                    <div class="info-item">
                        <div class="info-label">主硬盘</div>
                        <div class="info-value">Samsung 980 Pro 1TB</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">类型</div>
                        <div class="info-value">NVMe SSD</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">第二硬盘</div>
                        <div class="info-value">Seagate Barracuda 2TB</div>
                    </div>
                </div>
            </div>
            
            <div class="card" style="margin-top: 20px;">
                <h3 class="card-title"><i class="fas fa-network-wired"></i>网络设备</h3>
                <div class="hardware-info" style="margin-top: 15px;">
                    <div class="info-item">
                        <div class="info-label">有线网卡</div>
                        <div class="info-value">Intel I225-V 2.5GbE</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">无线网卡</div>
                        <div class="info-value">Intel Wi-Fi 6E AX210</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">蓝牙</div>
                        <div class="info-value">蓝牙 5.2</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 实用工具 -->
        <div class="section" id="tools">
            <div class="section-header">
                <h2 class="section-title">实用工具</h2>
            </div>
            <p class="section-description">各种黑苹果安装和维护工具</p>
            
            <div class="grid">
                <div class="card">
                    <h3 class="card-title"><i class="fas fa-key"></i>EFI编辑器</h3>
                    <p>编辑和配置您的EFI分区</p>
                    <button class="btn btn-primary" style="margin-top: 15px;">
                        <i class="fas fa-edit"></i> 打开编辑器
                    </button>
                </div>
                
                <div class="card">
                    <h3 class="card-title"><i class="fas fa-plug"></i>Kext管理器</h3>
                    <p>管理您的内核扩展驱动</p>
                    <button class="btn btn-primary" style="margin-top: 15px;">
                        <i class="fas fa-cog"></i> 管理Kext
                    </button>
                </div>
                
                <div class="card">
                    <h3 class="card-title"><i class="fas fa-terminal"></i>ACPI工具</h3>
                    <p>分析和编辑ACPI表</p>
                    <button class="btn btn-primary" style="margin-top: 15px;">
                        <i class="fas fa-table"></i> 打开工具
                    </button>
                </div>
                
                <div class="card">
                    <h3 class="card-title"><i class="fas fa-bug"></i>问题诊断</h3>
                    <p>诊断和解决常见问题</p>
                    <button class="btn btn-primary" style="margin-top: 15px;">
                        <i class="fas fa-stethoscope"></i> 开始诊断
                    </button>
                </div>
                
                <div class="card">
                    <h3 class="card-title"><i class="fas fa-sync-alt"></i>驱动更新</h3>
                    <p>检查并更新驱动程序</p>
                    <button class="btn btn-primary" style="margin-top: 15px;">
                        <i class="fas fa-cloud-download-alt"></i> 检查更新
                    </button>
                </div>
                
                <div class="card">
                    <h3 class="card-title"><i class="fas fa-shield-alt"></i>系统修复</h3>
                    <p>修复常见系统问题</p>
                    <button class="btn btn-primary" style="margin-top: 15px;">
                        <i class="fas fa-wrench"></i> 修复工具
                    </button>
                </div>
            </div>
        </div>

        <!-- 设置 -->
        <div class="section" id="settings">
            <div class="section-header">
                <h2 class="section-title">设置</h2>
            </div>
            <p class="section-description">配置SimpleToolkit的选项和偏好</p>
            
            <div class="card">
                <h3 class="card-title"><i class="fas fa-paint-brush"></i>外观</h3>
                <div style="margin-top: 15px;">
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px;">主题颜色</label>
                        <div class="color-picker">
                            <div style="background: linear-gradient(to right, #3a7bd5, #00d2ff);" title="蓝色渐变"></div>
                            <div style="background: linear-gradient(to right, #8E2DE2, #4A00E0);" title="紫色渐变"></div>
                            <div style="background: linear-gradient(to right, #f12711, #f5af19);" title="橙红渐变"></div>
                            <div style="background: linear-gradient(to right, #11998e, #38ef7d);" title="绿色渐变"></div>
                            <div style="background: linear-gradient(to right, #c31432, #240b36);" title="深红渐变"></div>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px;">主题模式</label>
                        <div style="display: flex; gap: 10px;">
                            <label style="display: flex; align-items: center; cursor: pointer;">
                                <input type="radio" name="theme" value="light" checked style="margin-right: 5px;"> 浅色
                            </label>
                            <label style="display: flex; align-items: center; cursor: pointer;">
                                <input type="radio" name="theme" value="dark" style="margin-right: 5px;"> 深色
                            </label>
                            <label style="display: flex; align-items: center; cursor: pointer;">
                                <input type="radio" name="theme" value="system" style="margin-right: 5px;"> 系统默认
                            </label>
                        </div>
                    </div>
                    
                    <div>
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="checkbox" id="animation-toggle" checked style="margin-right: 10px;"> 启用动画效果
                        </label>
                    </div>
                </div>
            </div>
            
            <div class="card" style="margin-top: 20px;">
                <h3 class="card-title"><i class="fas fa-folder-open"></i>路径设置</h3>
                <div style="margin-top: 15px;">
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px;">默认下载目录</label>
                        <div style="display: flex; gap: 10px;">
                            <input type="text" value="C:\Users\Username\Downloads" style="flex: 1; padding: 8px; border-radius: 8px; border: 1px solid #ddd;">
                            <button class="btn btn-outline">
                                <i class="fas fa-folder-open"></i> 浏览
                            </button>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px;">EFI备份目录</label>
                        <div style="display: flex; gap: 10px;">
                            <input type="text" value="C:\Users\Username\Documents\EFI_Backup" style="flex: 1; padding: 8px; border-radius: 8px; border: 1px solid #ddd;">
                            <button class="btn btn-outline">
                                <i class="fas fa-folder-open"></i> 浏览
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="card" style="margin-top: 20px;">
                <h3 class="card-title"><i class="fas fa-cogs"></i>高级设置</h3>
                <div style="margin-top: 15px;">
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; margin-bottom: 5px;">日志级别</label>
                        <select style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid #ddd;">
                            <option>仅错误</option>
                            <option selected>警告</option>
                            <option>信息</option>
                            <option>调试</option>
                        </select>
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="checkbox" id="auto-update-toggle" checked style="margin-right: 10px;">
                            <span>自动检查更新</span>
                        </label>
                    </div>
        
                    <div>
                        <label style="display: flex; align-items: center; cursor: pointer;">
                            <input type="checkbox" id="developer-mode-toggle" style="margin-right: 10px;">
                            <span>启用开发者模式</span>
                        </label>
                    </div>
                </div>
            </div>
            
            <div class="card" style="margin-top: 20px;">
                <h3 class="card-title"><i class="fas fa-info-circle"></i>关于</h3>
                <div style="margin-top: 15px;">
                    <div style="display: flex; align-items: center; margin-bottom: 15px;">
                        <img src="/static/gui_toolkit.ico" alt="Logo" style="width: 64px; height: 64px; margin-right: 15px; border-radius: 12px;">
                        <div>
                            <h4>SimpleToolkit</h4>
                            <p style="color: var(--text-light); display: flex; align-items: center;">
                                版本 <span id="current-version">1.0.1</span>
                                <span class="version-badge update-badge" style="margin-left: 10px;"></span>
                            </p>
                            <p style="color: var(--text-light);">作者：laobamac</p>
                        </div>
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <p>一款为黑苹果爱好者设计的工具箱，简化安装和配置过程。</p>
                    </div>
                    
                    <div>
                        <button id="check-update-btn" class="btn btn-primary">
                            <i class="fas fa-sync-alt"></i> 检查更新
                        </button>
                        <button class="btn btn-outline" style="margin-left: 10px;">
                            <i class="fas fa-book"></i> 用户手册
                        </button>
                        <button class="btn btn-outline" style="margin-left: 10px;">
                            <i class="fas fa-question-circle"></i> 帮助
                        </button>
                        <button class="btn btn-outline" style="margin-left: 10px;">
                            <i class="fas fa-bug"></i> 报告问题
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script src="/static/scripts.js"></script>
</body>
</html>
"""

@app.route('/api/preferences', methods=['POST'])
def save_preferences():
    try:
        # 获取当前偏好设置
        current_prefs = load_preferences()
        
        # 获取并验证前端数据
        data = request.get_json()
        if not data:
            raise ValueError("请求数据为空")
        
        # 处理主题颜色
        if 'themeColor' in data:
            try:
                if data['themeColor'] is not None:
                    json.loads(data['themeColor'])  # 验证JSON格式
                current_prefs['themeColor'] = data['themeColor']
            except json.JSONDecodeError:
                print("主题颜色JSON格式无效")
        
        # 处理主题模式 (修复点)
        if 'themeMode' in data:
            if data['themeMode'] in ['light', 'dark', 'system']:
                current_prefs['themeMode'] = data['themeMode']
            else:
                print(f"无效的主题模式: {data['themeMode']}")
        
        # 处理其他设置
        bool_settings = ['animationsEnabled', 'autoUpdateCheck', 'developerMode']
        for setting in bool_settings:
            if setting in data:
                current_prefs[setting] = str(data[setting]).lower() in ('true', '1', 't')
        
        # 处理单选按钮组
        if 'radioGroups' in data and isinstance(data['radioGroups'], dict):
            for group, value in data['radioGroups'].items():
                if value is not None:  # 允许保存null/None值
                    current_prefs['radioGroups'][group] = value
        
        # 保存更新后的设置
        with open(PREFERENCES_PATH, 'w') as f:
            json.dump(current_prefs, f, indent=2)
        
        return jsonify({"status": "success"})
    
    except Exception as e:
        print(f"保存偏好设置出错: {str(e)}")
        return jsonify({
            "status": "error",
            "message": "保存设置失败",
            "details": str(e)
        }), 400

def select_save_path(filename=""):
            try:
                # 确保下载目录存在
                downloads_dir = str(Path.home() / "Downloads")
                os.makedirs(downloads_dir, exist_ok=True)
            
                # 清理文件名
                safe_name = "".join(c for c in filename if c.isalnum() or c in (' ', '.', '_', '-'))
                safe_name = safe_name[:255]  # 限制长度
            
                # 调用文件对话框
                result = window.create_file_dialog(
                    webview.SAVE_DIALOG,
                    directory=downloads_dir,
                    save_filename=safe_name,
                    file_types=("DMG文件 (*.dmg)", "所有文件 (*.*)")
                )
                return result[0] if result else None
            except Exception as e:
                print(f"选择保存路径出错: {str(e)}")
                return None

def open_file_dialog(filename):
    try:
        result = window.create_file_dialog(
            webview.SAVE_DIALOG,
            directory=str(Path.home() / "Downloads"),
            save_filename=filename,
            file_types=("DMG Files (*.dmg)", "All files (*.*)")
        )
        return result[0] if result else None
    except Exception as e:
        print(f"文件对话框错误: {str(e)}")
        return None

def get_all_radio_values(html_content):
    """从HTML中提取所有单选按钮组的名称"""
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html_content, 'html.parser')
    radio_groups = {}
    for radio in soup.find_all('input', {'type': 'radio'}):
        group_name = radio.get('name')
        if group_name and group_name not in radio_groups:
            radio_groups[group_name] = None
    return radio_groups

@app.route('/api/preferences', methods=['GET'])
def get_preferences():
    try:
        prefs = load_preferences()
        # 确保返回所有必要字段
        default_prefs = {
            'themeColor': None,
            'themeMode': 'system',
            'animationsEnabled': True,
            'autoUpdateCheck': True,
            'developerMode': False,
            'radioGroups': {}
        }
        # 合并默认值和已保存值
        for key in default_prefs:
            if key not in prefs:
                prefs[key] = default_prefs[key]
        return jsonify(prefs)
    except Exception as e:
        print(f"加载偏好设置出错: {str(e)}")
        return jsonify(default_prefs), 200

@app.cli.command('init-preferences')
def initialize_preferences():
    """初始化偏好设置文件"""
    ensure_preferences_dir()
    if not PREFERENCES_PATH.exists():
        radio_groups = get_all_radio_values(HTML)
        default_prefs = {
            'themeColor': None,
            'themeMode': 'system',
            'animationsEnabled': 'true',
            'autoUpdateCheck': 'true',
            'developerMode': 'false',
            'radioGroups': {name: None for name in radio_groups}
        }
        save_preferences(default_prefs)

@app.route('/')
def home():
    return render_template_string(HTML)

@app.route('/static/<path:filename>')
def static_files(filename):
    return send_from_directory(resource_path('static'), filename)

@app.route('/static/webfonts/<path:filename>')
def webfonts_files(filename):
    return send_from_directory(resource_path('static/webfonts'), filename)


@app.route('/api/check-update')
def check_update():
    """检查更新接口（服务端代理）"""
    try:
        # 实际请求外部API
        response = requests.get(
            'https://stapi.simplehac.cn/checkUpdate',
            timeout=5,  # 5秒超时
            headers={'User-Agent': 'SimpleToolkit/1.0'},  # 添加UA标识
            verify=True  # 验证SSL证书
        )
        
        # 检查HTTP状态码
        response.raise_for_status()
        
        # 验证响应格式
        data = response.json()
        required_fields = ['latestVersion', 'downloadUrl', 'releaseNotes', 'releaseDate']
        if not all(field in data for field in required_fields):
            raise ValueError("Invalid API response format")
            
        # 添加客户端需要的附加字段
        data['updateAvailable'] = data['latestVersion'] != '1.0.1'  # 应与客户端版本对比
        
        if 'releaseNotes' in data:
            data['releaseNotes'] = data['releaseNotes'].replace('\\n', '\n')
        
        return jsonify(data)
        
    except requests.exceptions.Timeout:
        return jsonify({'error': '连接更新服务器超时'}), 504
    except requests.exceptions.HTTPError as e:
        return jsonify({'error': f'更新服务器响应异常 ({e.response.status_code})'}), 502
    except (requests.exceptions.RequestException, ValueError) as e:
        return jsonify({'error': f'检查更新失败: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'未知错误: {str(e)}'}), 500
    
@app.route('/api/dmg-list')
def get_dmg_list():
    """获取DMG镜像列表API"""
    try:
        result = download_handler.get_dmg_list()
        return jsonify(result)
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': f'服务器错误: {str(e)}'
        }), 500

@app.route('/api/start-download', methods=['POST'])
def start_download():
    try:
        data = request.get_json()
        if not data or 'url' not in data or 'save_path' not in data:
            raise ValueError("无效的请求数据")
        
        download_id = download_handler.start_download(data['url'], data['save_path'])
        if not download_id:
            raise Exception("无法启动下载")
            
        return jsonify({
            'success': True,
            'download_id': download_id
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400

@app.route('/api/cancel-download', methods=['POST'])
def cancel_download():
    try:
        data = request.get_json()
        if not data or 'download_id' not in data:
            raise ValueError("无效的请求数据")
        
        success = download_handler.cancel_download(data['download_id'])
        return jsonify({
            'success': success,
            'message': '下载已取消' if success else '无法取消下载'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 400
    
@app.route('/api/select-save-path', methods=['POST'])
def api_select_save_path():
    try:
        data = request.get_json()
        filename = data.get('filename', 'download.dmg')
        
        save_path = download_manager.select_save_path(filename)
        if not save_path:
            return jsonify({'success': False, 'message': '用户取消选择'})
            
        return jsonify({
            'success': True,
            'path': save_path
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'选择保存路径失败: {str(e)}'
        }), 500
    
@app.route('/api/verify-path', methods=['POST'])
def verify_path():
    data = request.get_json()
    path = data.get('path')
    
    try:
        # 尝试创建测试文件
        test_path = os.path.join(os.path.dirname(path), 'write_test.tmp')
        with open(test_path, 'w') as f:
            f.write('test')
        os.remove(test_path)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f"路径验证失败: {str(e)}"
        }), 400

if __name__ == '__main__':
    # 确保必要的目录存在
    ensure_preferences_dir()
    required_dirs = [
        resource_path('static'),
        resource_path('static/webfonts'),
        resource_path('static/fontawesome')
    ]
    for dir_path in required_dirs:
        if not os.path.exists(dir_path):
            os.makedirs(dir_path)
    
    # 创建空的ico文件（如果不存在）
    ico_path = os.path.join(resource_path('static'), 'gui_toolkit.ico')
    if not os.path.exists(ico_path):
        with open(ico_path, 'wb') as f:
            f.write(b'')

    # 启动Flask服务器
    import threading
    t = threading.Thread(target=app.run, kwargs={'port': 5848})
    t.daemon = True
    t.start()
    
    # 创建PyWebView窗口
    window = webview.create_window(
        'SimpleToolkit',
        'http://localhost:5848',
        width=1200,
        height=800,
        resizable=False,
        frameless=False,
        easy_drag=True,
        transparent=False,
        on_top=False,
        confirm_close=False  # 禁用关闭确认
    )
    download_handler = DownloadHandler(window)
    download_manager = DownloadManager(window)
    window.expose(open_file_dialog)
    window.expose(select_save_path)


    @window.expose
    def get_downloads_dir():
        return str(Path.home() / "Downloads")

    @window.expose
    def open_file_location(path):
            os.startfile(os.path.dirname(path))
    # 启动窗口

    webview.start(icon=ico_path)