<p align="center">
  <img src="https://img.wjwj.top/2025/01/27/d32c2e675ab3aa08a0d34fd147bf54c2.png" width="300" alt="SimpleToolkit Logo">
</p>

<h1 align="center">SimpleToolkit 🍎</h1>
<p align="center">
  一站式黑苹果工具箱 | 让 Hackintosh 安装更简单
  <br>
  <sub>⚠️ 项目正在活跃开发中，尚未完全实现 | 最近更新: 2025-04-20</sub>
</p>

<div align="center">
  
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![GitHub Release](https://img.shields.io/github/v/release/yourname/SimpleToolkit?color=green)](https://github.com/yourname/SimpleToolkit/releases)
[![Status](https://img.shields.io/badge/status-开发中-yellow)](https://github.com/yourname/SimpleToolkit/commits/main)
[![Last Commit](https://img.shields.io/github/last-commit/yourname/SimpleToolkit?color=orange)](https://github.com/yourname/SimpleToolkit/commits/main)
[![Downloads](https://img.shields.io/github/downloads/yourname/SimpleToolkit/total?color=blue)](https://github.com/yourname/SimpleToolkit/releases)
[![Open Issues](https://img.shields.io/github/issues/yourname/SimpleToolkit?color=red)](https://github.com/yourname/SimpleToolkit/issues)

</div>

---

## 🌟 项目亮点
- **全流程支持**：从镜像下载到硬件定制，覆盖黑苹果安装全场景  
- **智能自动化**：一键生成 SSDT/USB 补丁，告别复杂配置  
- **硬件兼容性**：深度适配 Intel/AMD 主流平台，支持 macOS 10.15+  

---

## 🛠️ 功能大全

### 🖼️ 系统准备
| 功能               | 描述                                                                 |
|--------------------|--------------------------------------------------------------------|
| **镜像下载**       | 支持 Big Sur/Monterey/Ventura 等全版本镜像，附带校验信息与高速下载 |
| **镜像烧录**       | 智能识别 USB 设备，支持 DMG/ISO/IMG 格式，可选 OpenCore 引导集成    |

### 🔌 硬件定制
| 功能               | 描述                                                                 |
|--------------------|--------------------------------------------------------------------|
| **USB 端口映射**   | 自动扫描 15+ USB 端口类型，生成完美兼容的 `USBMap.kext`            |
| **SSDT 生成器**    | 基于硬件信息自动生成电源管理/设备补丁（支持 CPU/GPU/声卡等）       |

### 📊 系统维护
| 工具               | 功能亮点                                                         |
|--------------------|----------------------------------------------------------------|
| **EFI 编辑器**     | 可视化编辑 EFI 分区，支持 OC/Kexts/ACPI 文件管理                |
| **问题诊断**       | 一键检测常见安装错误（内核崩溃/USB 失效/引导失败）              |
| **驱动管理器**     | 自动检测并更新 OpenCore/Lilu/VirtualSMC 等核心驱动             |
| 更多内容见软件内   |                                                                 |

---

## 🚀 快速入门

### 系统要求
- Windows 10/11 64-bit
- 16GB+ 内存（推荐 32GB 用于大型镜像处理）
- 50GB 可用磁盘空间

---

使用示例：USB 定制
连接所有 USB 设备到主板不同接口

点击 USB定制 → 检测端口

导出到 EFI/OC/Kexts 目录

重启享受完美 USB 支持！

## 🎨 界面定制

- **主题系统**  
  ![浅色模式]() ![深色模式]()  
  支持跟随系统自动切换，可自定义强调色

- **高级设置**  
  ```plaintext
  日志级别: [警告] [错误] [调试]
  自动更新: 每日检查 ✔️
  开发者模式: 启用后显示 ACPI 原始表 ✔️

  ---

## 🤝 参与贡献
欢迎通过以下方式助力项目发展：
1. 提交 [Issues](https://github.com/laobamac/SimpleToolkitGUI/issues) 反馈问题
2. 发起 [Pull Requests](https://github.com/laobamac/SimpleToolkitGUI/pulls) 添加新功能
3. 完善 [Wiki 文档](https://github.com/laobamac/SimpleToolkitGUI/wiki)

**开发规范**  
- 使用Python编写核心模块
- UI 层采用 Webview + Flask 框架
- 遵循 MIT 开源协议

---

## 📜 许可证
本项目基于 **MIT License** 开源  
完整协议见 [LICENSE](LICENSE) 文件

---

<p align="center">
  Made with ❤️ by laobamac | 辅助Hackintosh从未如此简单
</p>
