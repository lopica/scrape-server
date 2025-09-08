import http from 'http';
import url from 'url';
import fs from 'fs';
import cron from 'node-cron';
import { scrapeMienBacGoldPrices } from "./gold.js";
import { getAllPetrolData } from "./petrol.js";

let petrolData = null;
let goldData = null;
let lastPetrolUpdate = null;
let lastGoldUpdate = null;

// Hàm cập nhật dữ liệu petrol (chạy 1 lần/ngày)
async function updatePetrolData() {
  try {
    console.log('🚗 Updating petrol data...');
    
    petrolData = await getAllPetrolData();
    
    console.log('🔍 Petrol data result:', petrolData ? 'Success' : 'Failed/Null');
    
    if (!petrolData) {
      console.log('⚠️ No petrol data received from scraper');
      return;
    }
    
    lastPetrolUpdate = new Date().toISOString();
    
    // Đọc dữ liệu cũ và thêm dữ liệu mới
    let existingData = [];
    try {
      if (fs.existsSync('petrol.json')) {
        const fileContent = fs.readFileSync('petrol.json', 'utf8');
        const parsed = JSON.parse(fileContent);
        existingData = Array.isArray(parsed) ? parsed : (parsed.history || []);
      }
    } catch (error) {
      console.log('⚠️ Could not read existing petrol data, starting fresh');
    }

    const newEntry = {
      data: petrolData,
      lastUpdate: lastPetrolUpdate,
      timestamp: new Date().toISOString()
    };
    
    existingData.push(newEntry);
    fs.writeFileSync('petrol.json', JSON.stringify(existingData, null, 2));
    
    console.log('✅ Petrol data updated successfully');
    console.log('📄 Petrol data saved to petrol.json');
    
    // Log kết quả
    if (petrolData && petrolData.products) {
      console.log(`📊 Petrol Products (${petrolData.products.length} items):`);
      petrolData.products.forEach((product, index) => {
        console.log(`  ${index + 1}. ${product.productName} - Region 1: ${product.region1Price} - Region 2: ${product.region2Price}`);
      });
    }
  } catch (error) {
    console.error('❌ Error updating petrol data:', error);
  }
}

// Hàm cập nhật dữ liệu gold (chạy mỗi giờ)
async function updateGoldData() {
  const startTime = new Date();
  try {
    console.log(`🥇 [${startTime.toLocaleTimeString()}] Starting gold data update...`);
    
    goldData = await scrapeMienBacGoldPrices();
    
    lastGoldUpdate = new Date().toISOString();
    
    // Kiểm tra dữ liệu có hợp lệ không
    if (!goldData || goldData.length === 0) {
      console.log('⚠️ No gold data received from scraper');
      return;
    }
    
    // Đọc dữ liệu cũ và thêm dữ liệu mới
    let existingData = [];
    try {
      if (fs.existsSync('gold.json')) {
        const fileContent = fs.readFileSync('gold.json', 'utf8');
        const parsed = JSON.parse(fileContent);
        existingData = Array.isArray(parsed) ? parsed : (parsed.history || []);
      }
    } catch (error) {
      console.log('⚠️ Could not read existing gold data, starting fresh');
    }

    const newEntry = {
      data: goldData,
      lastUpdate: lastGoldUpdate,
      timestamp: new Date().toISOString()
    };
    
    existingData.push(newEntry);
    fs.writeFileSync('gold.json', JSON.stringify(existingData, null, 2));
    
    const endTime = new Date();
    const duration = endTime - startTime;
    
    console.log(`✅ [${endTime.toLocaleTimeString()}] Gold data updated successfully (took ${duration}ms)`);
    console.log('📄 Gold data saved to gold.json');
    
    // Log kết quả
    console.log(`📊 Gold Prices (${goldData.length} items):`);
    goldData.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.goldType} - Buy: ${item.buyPriceFormatted} - Sell: ${item.sellPriceFormatted}`);
    });
    
  } catch (error) {
    const endTime = new Date();
    const duration = endTime - startTime;
    console.error(`❌ [${endTime.toLocaleTimeString()}] Error updating gold data (after ${duration}ms):`, error.message);
    console.error('Full error:', error);
  }
}

// Tạo HTTP server
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  switch (pathname) {
    case '/petrol':
      res.writeHead(200);
      res.end(JSON.stringify({
        data: petrolData,
        lastUpdate: lastPetrolUpdate,
        timestamp: new Date().toISOString()
      }, null, 2));
      break;

    case '/gold':
      res.writeHead(200);
      res.end(JSON.stringify({
        data: goldData,
        lastUpdate: lastGoldUpdate,
        timestamp: new Date().toISOString()
      }, null, 2));
      break;

    case '/status':
      res.writeHead(200);
      res.end(JSON.stringify({
        server: 'running',
        petrol: {
          hasData: !!petrolData,
          lastUpdate: lastPetrolUpdate
        },
        gold: {
          hasData: !!goldData,
          lastUpdate: lastGoldUpdate
        },
        uptime: process.uptime()
      }, null, 2));
      break;

    default:
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
  }
});

// Khởi chạy server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log('📍 Available endpoints:');
  console.log('  - GET /petrol - Petrol prices data');
  console.log('  - GET /gold - Gold prices data');
  console.log('  - GET /status - Server status');
});

// Lập lịch cập nhật dữ liệu petrol (1 lần/ngày lúc 6:00 AM)
cron.schedule('0 6 * * *', updatePetrolData);
console.log('⏰ Petrol data scheduled to update daily at 6:00 AM');

// Lập lịch cập nhật dữ liệu gold (mỗi giờ)
cron.schedule('0 * * * *', updateGoldData);
console.log('⏰ Gold data scheduled to update every hour');

// Cập nhật dữ liệu lần đầu
console.log('🔄 Starting initial data updates...');
updatePetrolData();
setTimeout(() => updateGoldData(), 5000); // Delay gold update to avoid conflicts




