# 运行时修复（试用）

这两个工具与外观补丁分开使用，仅验证过 Windows x64、RazerAppEngine **4.0.896**、`mapping_engine.dll` **1.3.17.2**。不是雷蛇官方修复，也没有做完整稳定性测试。

工具只作用于当前雷云进程。退出并重新启动雷云即可撤销，之后需要重新应用。不会安装后台服务或开机任务，不会替换安装目录的 DLL。

需要 .NET 8 SDK。以下命令在仓库根目录运行。

## 键盘文本功能崩溃

现象：Fn+D、Fn+C 绑定“文本功能”，触发后 `RazerAppEngine.exe` 以 `0xC0000005` 退出。

本机转储中，异常指令位于 `mapping_engine.dll+0x208441`，访问 `[rdi+0x10]` 时 `rdi` 为零。调用链包含 `ClipboardWin::ReadPng`、`PostTaskAndReply`，线程池实例指针也为零。补丁把位图转 PNG 的后备分支改为同步调用原有编码函数和回调，保留清理流程。

```powershell
dotnet build tools/KeyboardTextFix -c Release
dotnet run --project tools/KeyboardTextFix -c Release --no-build
```

恢复本次进程中的原始指令：

```powershell
dotnet run --project tools/KeyboardTextFix -c Release --no-build -- --restore
```

`patch.json` 包含模块哈希、RVA、原始和替换字节。工具校验 DLL SHA-256 和当前内存字节，遇到不同版本或未知代码会拒绝操作。补丁共 110 字节，只有本次进程生效。大尺寸剪贴板位图的同步编码可能造成短暂延迟；图片保留流程尚未做完整验证。

## 鼠标 Win+V 侧键失效

本机巴塞利斯蛇 V3 专业版 35K 的侧键只发出普通 X2，没有 Win、V；炼狱蝰蛇则正常。接收器初始化日志反复出现 `skip empty DualLink mapping table`，运行时没有应用对应的映射数据。

本次通过原生 `localStorageSetItem` 接口重新加载雷云此前已经生成的同一份非空映射，侧键恢复。修复后事件顺序为 Win 按下、V 按下、V 松开、Win 松开。

这是对漏载运行时状态的恢复，**不是厂商源码补丁**。仓库仅发布通用代码，不附带作者的接收器标识、账号信息、侧键设置或配置快照。

先在本机找到需要处理的接收器 Container GUID，再从雷云日志导出自己的数据：

```powershell
node tools/export-mouse-runtime.cjs YOUR-RECEIVER-CONTAINER-GUID
dotnet build tools/MouseRuntimeFix -c Release
dotnet run --project tools/MouseRuntimeFix -c Release --no-build -- --validate private-runtime/mouse-runtime-snapshot.json
```

核对导出时间、当前配置和侧键绑定后，再加载到已经运行的雷云：

```powershell
dotnet run --project tools/MouseRuntimeFix -c Release --no-build -- --snapshot private-runtime/mouse-runtime-snapshot.json
```

`--validate` 只检查快照结构，不打开或修改进程。实际加载时还会校验 DLL 的固定 SHA-256，并等待相应接收器初始化。工具使用远程线程调用该版本 DLL 的原生接口，接口偏移仅对校验通过的 DLL 有效。

`private-runtime/` 已加入忽略列表。快照可能含设备标识、配置名称及绑定，不能上传。修改绑定、切换配置后，旧快照可能覆盖新的运行时状态，需要重新导出和核对；没有可用日志时不要拿别人的快照替代。

## 本次验证范围

- 键盘：用户实际测试 Fn+D、Fn+C，原文本正常输出，未再崩溃；内存回退、重复应用均验证过。
- 鼠标：用户实际测试巴塞利斯蛇侧键，能打开剪贴板历史；按键事件记录确认顺序正常。
- 公开版本移除了本机接收器常量，并加入快照结构检查；进行了编译及只读校验。
- 未覆盖其他 DLL 版本、所有鼠标、长期运行、完整关机开机及后续配置变更。
