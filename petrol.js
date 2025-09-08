import puppeteer from "puppeteer";

const url = "https://www.petrolimex.com.vn/index.html";

export async function getAllPetrolData() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  // Chỉnh viewport
  await page.setViewport({
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
  });

  try {
    await page.goto(url, { waitUntil: "networkidle2" });

    // Click vào link "Giá bán lẻ xăng dầu"
    await page.click("text=Giá bán lẻ xăng dầu");
    await page.waitForSelector("table", { timeout: 10000 });

    // Lấy toàn bộ dữ liệu từ bảng
    const petrolData = await page.evaluate(() => {
      const table = document.querySelector("table");
      if (!table) return null;

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
    await browser.close();
  }
}



// Function để lấy chỉ một loại xăng cụ thể
async function getSpecificFuelData(fuelType = "RON 95-V") {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  await page.setViewport({
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
  });

  try {
    await page.goto(url, { waitUntil: "networkidle2" });
    await page.click("text=Giá bán lẻ xăng dầu");
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