import { chromium } from 'playwright';

const url = "https://www.petrolimex.com.vn/index.html";

export async function getAllPetrolData() {
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-default-apps',
        '--disable-sync',
        '--metrics-recording-only',
        '--no-default-browser-check',
        '--no-pings',
        '--password-store=basic',
        '--use-mock-keychain',
        '--single-process'
      ]
    });
  } catch (launchError) {
    console.error('❌ Failed to launch browser:', launchError.message);
    throw new Error(`Browser launch failed: ${launchError.message}`);
  }
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {

    await page.goto(url, { 
      waitUntil: "networkidle",
      timeout: 60000
    });

    // Click vào link "Giá bán lẻ xăng dầu"
    try {
      await page.getByText("Giá bán lẻ xăng dầu").click();
      
      // Wait for navigation or content to load
      await page.waitForTimeout(2000);
      
      // Wait for table to exist (not necessarily visible)
      await page.waitForSelector("table", { state: 'attached', timeout: 30000 });
    } catch (clickError) {
      console.log("Trying alternative selector...");
      // Try alternative selector
      await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a'));
        const targetLink = links.find(link => link.textContent.includes('Giá bán lẻ xăng dầu'));
        if (targetLink) {
          targetLink.click();
        }
      });
      
      await page.waitForTimeout(2000);
      await page.waitForSelector("table", { state: 'attached', timeout: 30000 });
    }
    
    // Wait for table content to be populated
    try {
      await page.waitForFunction(() => {
        const tables = document.querySelectorAll('table');
        for (let table of tables) {
          const rows = table.querySelectorAll('tr');
          if (rows.length > 1) { // More than just header
            return true;
          }
        }
        return false;
      }, { timeout: 15000 });
    } catch (contentError) {
      console.log('⚠️ Table content may not be fully loaded, continuing anyway...');
    }

    // Lấy toàn bộ dữ liệu từ bảng
    const petrolData = await page.evaluate(() => {
      // Find the table with the most content
      const tables = document.querySelectorAll("table");
      let bestTable = null;
      let maxRows = 0;
      
      for (let table of tables) {
        const rows = table.querySelectorAll("tr");
        if (rows.length > maxRows) {
          maxRows = rows.length;
          bestTable = table;
        }
      }
      
      if (!bestTable) {
        console.log("No suitable table found");
        return null;
      }
      
      console.log(`Using table with ${maxRows} rows`);
      const table = bestTable;

      const rows = Array.from(table.querySelectorAll("tr"));
      const data = [];

      rows.forEach((row, index) => {
        const cells = Array.from(row.querySelectorAll("td, th"));
        if (cells.length > 0) {
          const rowData = cells.map(cell => cell.textContent.trim());
          data.push({
            rowIndex: index,
            data: rowData
          });
        }
      });

      return data;
    });

    // Xử lý và format dữ liệu
    if (petrolData && petrolData.length > 0) {
      // console.log("=== BẢNG GIÁ XĂNG DẦU PETROLIMEX ===\n");
      
      // // Header (thường là dòng đầu tiên)
      // if (petrolData[0]) {
      //   console.log("HEADER:", petrolData[0].data.join(" | "));
      //   console.log("-".repeat(50));
      // }

      // // Dữ liệu các loại xăng dầu
      // petrolData.slice(1).forEach((row, index) => {
      //   if (row.data.length >= 3) {
      //     const [sanPham, vung1, vung2] = row.data;
      //     console.log(`${index + 1}. ${sanPham}`);
      //     console.log(`   Vùng 1: ${vung1}`);
      //     console.log(`   Vùng 2: ${vung2}`);
      //     console.log("");
      //   }
      // });

      // Trả về dữ liệu dưới dạng object có cấu trúc
      const structuredData = {
        timestamp: new Date().toISOString(),
        products: petrolData.slice(1).map((row, index) => {
          if (row.data.length >= 3) {
            return {
              id: index + 1,
              productName: row.data[0],
              region1Price: row.data[1],
              region2Price: row.data[2]
            };
          }
          return null;
        }).filter(item => item !== null)
      };

      return structuredData;
    } else {
      console.log("Không tìm thấy dữ liệu bảng");
      return null;
    }

  } catch (error) {
    console.error("Lỗi khi lấy dữ liệu:", error);
    return null;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error("Error closing browser:", closeError.message);
      }
    }
  }
}



// Function để lấy chỉ một loại xăng cụ thể (using Playwright)
async function getSpecificFuelData(fuelType = "RON 95-V") {
  const browser = await chromium.launch({ 
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-extensions',
      '--disable-plugins',
      '--disable-default-apps',
      '--disable-sync',
      '--metrics-recording-only',
      '--no-default-browser-check',
      '--no-pings',
      '--password-store=basic',
      '--use-mock-keychain',
      '--single-process'
    ]
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    await page.getByText("Giá bán lẻ xăng dầu").click();
    await page.waitForSelector("table", { timeout: 10000 });

    const specificData = await page.evaluate((targetFuel) => {
      const rows = Array.from(document.querySelectorAll("table tr"));
      
      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll("td, th"));
        const rowText = cells.map(cell => cell.textContent.trim());
        
        // Tìm dòng chứa loại xăng cần tìm
        if (rowText.some(text => text.includes(targetFuel))) {
          return {
            productName: rowText[0],
            region1Price: rowText[1],
            region2Price: rowText[2]
          };
        }
      }
      return null;
    }, fuelType);

    return specificData;
  } catch (error) {
    console.error("Lỗi:", error);
    return null;
  } finally {
    await browser.close();
  }
}

// Uncomment để test function lấy xăng cụ thể
// getSpecificFuelData("RON 95-V").then(data => {
//   console.log("Dữ liệu RON 95-V:", data);
// });