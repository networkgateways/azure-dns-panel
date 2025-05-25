const express = require('express');
const cors = require('cors');
const { DefaultAzureCredential, ClientSecretCredential } = require("@azure/identity");
const { DnsManagementClient } = require("@azure/arm-dns");

const app = express();
const port = 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // 静态文件目录

// Azure DNS API 连接
async function getDnsClient(tenantId, clientId, clientSecret, subscriptionId) {
    const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
    return new DnsManagementClient(credential, subscriptionId);
}

// 认证接口
app.post('/api/auth', async (req, res) => {
    try {
        const { tenantId, clientId, clientSecret, subscriptionId } = req.body;
        
        if (!tenantId || !clientId || !clientSecret || !subscriptionId) {
            return res.status(400).json({ error: '所有凭据字段都是必需的' });
        }
        
        // 尝试验证凭据
        const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
        const dnsClient = new DnsManagementClient(credential, subscriptionId);
        
        // 尝试获取资源组列表来验证凭据是否有效
        await dnsClient.zones.list();
        
        // 认证成功
        res.json({ success: true, message: '身份验证成功' });
    } catch (error) {
        console.error('认证错误:', error);
        res.status(401).json({ 
            success: false, 
            error: '身份验证失败', 
            details: error.message 
        });
    }
});

// 获取DNS区域列表
app.post('/api/zones', async (req, res) => {
    try {
        const { tenantId, clientId, clientSecret, subscriptionId } = req.body;
        const dnsClient = await getDnsClient(tenantId, clientId, clientSecret, subscriptionId);
        
        const zones = await dnsClient.zones.list();
        const zonesList = [];
        
        for await (const zone of zones) {
            zonesList.push({
                id: zone.id,
                name: zone.name,
                resourceGroup: zone.id.split('/')[4] // 从资源ID中提取资源组名称
            });
        }
        
        res.json(zonesList);
    } catch (error) {
        console.error('获取DNS区域错误:', error);
        res.status(500).json({ error: '获取DNS区域失败', details: error.message });
    }
});

// 获取指定区域的DNS记录
app.post('/api/records', async (req, res) => {
    try {
        const { tenantId, clientId, clientSecret, subscriptionId, zoneName, resourceGroup } = req.body;
        const dnsClient = await getDnsClient(tenantId, clientId, clientSecret, subscriptionId);
        
        const recordSets = await dnsClient.recordSets.listByDnsZone(resourceGroup, zoneName);
        const records = [];
        
        for await (const record of recordSets) {
            // 获取记录值
            let value = '';
            let type = record.type.replace('Microsoft.Network/dnszones/', '');
            
            if (record.aRecords && record.aRecords.length > 0) {
                value = record.aRecords.map(r => r.ipv4Address).join(', ');
            } else if (record.aaaaRecords && record.aaaaRecords.length > 0) {
                value = record.aaaaRecords.map(r => r.ipv6Address).join(', ');
            } else if (record.cnameRecord) {
                value = record.cnameRecord.cname;
            } else if (record.mxRecords && record.mxRecords.length > 0) {
                value = record.mxRecords.map(r => `${r.preference} ${r.exchange}`).join(', ');
            } else if (record.txtRecords && record.txtRecords.length > 0) {
                value = record.txtRecords.map(r => r.value.join('')).join(', ');
            } else if (record.nsRecords && record.nsRecords.length > 0) {
                value = record.nsRecords.map(r => r.nsdname).join(', ');
            } else if (record.soaRecord) {
                value = `${record.soaRecord.host} ${record.soaRecord.email}`;
            }
            
            // 将相对记录名称转换为显示名称
            let name = record.name === '@' ? '@' : record.name;
            
            records.push({
                id: record.id,
                name: name,
                type: type,
                value: value,
                ttl: record.ttl
            });
        }
        
        res.json(records);
    } catch (error) {
        console.error('获取DNS记录错误:', error);
        res.status(500).json({ error: '获取DNS记录失败', details: error.message });
    }
});

// 添加DNS记录
app.post('/api/records/add', async (req, res) => {
    try {
        const { 
            tenantId, clientId, clientSecret, subscriptionId,
            zoneName, resourceGroup, recordName, recordType, recordValue, recordTTL 
        } = req.body;
        
        const dnsClient = await getDnsClient(tenantId, clientId, clientSecret, subscriptionId);
        
        let parameters = {
            ttl: recordTTL
        };
        
        // 根据记录类型设置不同参数
        switch (recordType) {
            case 'A':
                parameters.aRecords = [{ ipv4Address: recordValue }];
                break;
            case 'AAAA':
                parameters.aaaaRecords = [{ ipv6Address: recordValue }];
                break;
            case 'CNAME':
                parameters.cnameRecord = { cname: recordValue };
                break;
            case 'MX':
                // 假设MX记录格式为"10 mail.example.com"
                const [preference, exchange] = recordValue.split(' ');
                parameters.mxRecords = [{ 
                    preference: parseInt(preference) || 10, 
                    exchange: exchange || recordValue 
                }];
                break;
            case 'TXT':
                parameters.txtRecords = [{ value: [recordValue] }];
                break;
            case 'NS':
                parameters.nsRecords = [{ nsdname: recordValue }];
                break;
            default:
                return res.status(400).json({ error: '不支持的记录类型' });
        }
        
        // 创建或更新记录
        await dnsClient.recordSets.createOrUpdate(
            resourceGroup,
            zoneName,
            recordName === '@' ? '@' : recordName,
            recordType,
            parameters
        );
        
        res.json({ success: true, message: 'DNS记录添加成功' });
    } catch (error) {
        console.error('添加DNS记录错误:', error);
        res.status(500).json({ error: '添加DNS记录失败', details: error.message });
    }
});

// 更新DNS记录
app.post('/api/records/update', async (req, res) => {
    try {
        const { 
            tenantId, clientId, clientSecret, subscriptionId,
            zoneName, resourceGroup, recordName, recordType, recordValue, recordTTL, recordId 
        } = req.body;
        
        const dnsClient = await getDnsClient(tenantId, clientId, clientSecret, subscriptionId);
        
        // 获取现有记录
        const existingRecord = await dnsClient.recordSets.get(
            resourceGroup,
            zoneName,
            recordName === '@' ? '@' : recordName,
            recordType
        );
        
        let parameters = {
            ttl: recordTTL
        };
        
        // 根据记录类型设置不同参数
        switch (recordType) {
            case 'A':
                parameters.aRecords = [{ ipv4Address: recordValue }];
                break;
            case 'AAAA':
                parameters.aaaaRecords = [{ ipv6Address: recordValue }];
                break;
            case 'CNAME':
                parameters.cnameRecord = { cname: recordValue };
                break;
            case 'MX':
                // 假设MX记录格式为"10 mail.example.com"
                const [preference, exchange] = recordValue.split(' ');
                parameters.mxRecords = [{ 
                    preference: parseInt(preference) || 10, 
                    exchange: exchange || recordValue 
                }];
                break;
            case 'TXT':
                parameters.txtRecords = [{ value: [recordValue] }];
                break;
            case 'NS':
                parameters.nsRecords = [{ nsdname: recordValue }];
                break;
            default:
                return res.status(400).json({ error: '不支持的记录类型' });
        }
        
        // 更新记录
        await dnsClient.recordSets.createOrUpdate(
            resourceGroup,
            zoneName,
            recordName === '@' ? '@' : recordName,
            recordType,
            parameters
        );
        
        res.json({ success: true, message: 'DNS记录更新成功' });
    } catch (error) {
        console.error('更新DNS记录错误:', error);
        res.status(500).json({ error: '更新DNS记录失败', details: error.message });
    }
});

// 删除DNS记录 - 修复了方法名
app.post('/api/records/delete', async (req, res) => {
    try {
        const { 
            tenantId, clientId, clientSecret, subscriptionId,
            zoneName, resourceGroup, recordName, recordType
        } = req.body;
        
        const dnsClient = await getDnsClient(tenantId, clientId, clientSecret, subscriptionId);
        
        // 删除记录 - 使用正确的方法名 'delete'
        await dnsClient.recordSets.delete(
            resourceGroup,
            zoneName,
            recordName === '@' ? '@' : recordName,
            recordType
        );
        
        res.json({ success: true, message: 'DNS记录删除成功' });
    } catch (error) {
        console.error('删除DNS记录错误:', error);
        res.status(500).json({ error: '删除DNS记录失败', details: error.message });
    }
});

// 启动服务器
app.listen(port, () => {
    console.log(`Azure DNS 管理面板后端服务运行在 http://localhost:${port}`);
});