# Azure DNS Management Panel

A web-based Azure DNS management tool that allows you to easily view, add, edit, and delete DNS records.

## 🚀 Features

- 🔐 Connect to Azure account  
- 🌐 View DNS zone list  
- 📄 View DNS record list  
- ➕ Add new DNS records  
- ✏️ Edit existing DNS records  
- 🗑️ Delete DNS records  

## 📦 Installation & Running

### Prerequisites

- Node.js 14.x or higher  
- npm or yarn  
- Azure account with valid credentials  

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/your-username/azure-dns-panel.git

# 2. Navigate to the project directory
cd azure-dns-panel

# 3. Install dependencies
npm install

# 4. Install PM2 globally if not installed
npm install pm2 -g

# 5. Start the server
pm2 start server.js
Open your browser and visit: http://localhost:3000

🔧 How to Use
Gather your Azure credentials:

Tenant ID

Client ID

Client Secret

Subscription ID

Fill in the credentials on the homepage and click Connect

Once connected:

DNS zones will appear in the left panel

Select a zone to view its records

Use Add Record to create new entries

Use Edit or Delete next to existing records to modify them

🔑 How to Obtain Azure Credentials
Get Tenant ID & Subscription ID
Log into the Azure Portal

Navigate to Azure Active Directory → Properties

Copy the Tenant ID

Go to Subscriptions

Select your subscription and copy the Subscription ID

Register an Application
Go to Azure Active Directory → App registrations

Click New registration

Enter a name (e.g., DNS Manager), choose supported account types, click Register

Copy the Application (client) ID

Create a Client Secret
In your app, go to Certificates & secrets

Click New client secret

Add a description and set an expiry

Click Add and copy the secret value immediately

Assign Role Permissions
Go to Resource groups → select your target group

Navigate to Access control (IAM)

Click Add role assignment

Select DNS Zone Contributor

Assign the role to your registered application

🔐 Security Notes
This app runs locally and communicates only with Azure

Do not share your client secret

Use a dedicated service principal with minimum required permissions

For production, ensure your deployment uses HTTPS
