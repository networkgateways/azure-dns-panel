# Azure DNS 管理面板

这是一个基于Web的Azure DNS管理工具，可以让您方便地查看、添加、编辑和删除DNS记录。

## 功能

- 连接到Azure账户
- 查看DNS区域列表
- 查看DNS记录列表
- 添加新的DNS记录
- 编辑现有的DNS记录
- 删除DNS记录

## 安装和运行

### 前提条件

- Node.js 14.x或更高版本
- npm或yarn
- Azure账户和有效的凭据

### 安装步骤

1. 克隆或下载此项目到本地
2. 进入项目目录
   ```
   cd azure-dns-manager
   ```
3. 安装依赖
   ```
   npm install
  
   ```
4. 安装PM2
   ```
   npm install pm2 -g
   ```   
5. 启动服务器
   ```
   pm2 start server.js
   ```
6. 打开浏览器访问 http://localhost:3000

## 如何使用

1. 准备以下Azure凭据:
   - 租户ID (Tenant ID)
   - 客户端ID (Client ID)
   - 客户端密钥 (Client Secret)
   - 订阅ID (Subscription ID)

2. 在面板主页填写上述凭据并点击"连接"按钮

3. 连接成功后，左侧会显示您的DNS区域列表

4. 点击某个区域旁的"选择"按钮，右侧会显示该区域的DNS记录

5. 使用"添加记录"按钮添加新记录，或使用每条记录右侧的"编辑"和"删除"按钮修改现有记录

## 获取Azure凭据

### 租户ID和订阅ID

1. 登录[Azure门户](https://portal.azure.com)
2. 点击"Azure Active Directory" -> "属性"，复制"租户ID"
3. 点击"订阅"，选择您的订阅并复制"订阅ID"

### 创建应用注册并获取客户端ID和密钥

1. 在Azure门户中，进入"Azure Active Directory" -> "应用注册"
2. 点击"新注册"
3. 输入名称(例如"DNS管理器")，选择账户类型，点击"注册"
4. 注册后，复制"应用程序(客户端)ID"
5. 在左侧菜单中点击"证书和密码"
6. 点击"新客户端密码"，添加描述并选择过期时间
7. 点击"添加"后立即复制生成的密钥值(它只显示一次!)

### 分配权限

1. 在Azure门户中，进入"订阅" -> 选择您的订阅
2. 点击"访问控制(IAM)" -> "添加角色分配"
3. 选择"DNS区域贡献者"角色
4. 分配给您刚创建的应用程序

## 安全注意事项

- 此应用程序在本地运行，不会将您的凭据传输到除Azure以外的任何地方
- 客户端密钥具有敏感性，请不要与他人共享
- 建议为此应用创建专用的服务主体，并只赋予必要的最小权限
- 在生产环境中，建议使用HTTPS

## 技术栈

- 前端: HTML, CSS, JavaScript
- 后端: Node.js, Express
- Azure SDK: @azure/arm-dns, @azure/identity

## 许可

MIT 