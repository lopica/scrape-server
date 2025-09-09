import { chromium } from 'playwright';

export async function scrapeMienBacGoldPrices() {
    let browser;
    
    try {
        // Khởi tạo browser
        browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
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
                '--single-process',
                '--disable-dbus',
                '--disable-x11-sandbox',
                '--disable-ipc-flooding-protection',
                '--disable-background-networking',
                '--disable-component-extensions-with-background-pages',
                '--disable-default-apps',
                '--disable-features=TranslateUI',
                '--disable-ipc-flooding-protection'
            ]
        });

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1366, height: 768 },
            extraHTTPHeaders: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'vi-VN,vi;q=0.8,en-US;q=0.5,en;q=0.3',
                'Accept-Encoding': 'gzip, deflate',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            }
        });
        const page = await context.newPage();
        
        console.log('🚀 Đang truy cập website SJC...');
        
        // Truy cập website SJC với retry logic
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
            try {
                await page.goto('https://sjc.com.vn/', {
                    waitUntil: 'domcontentloaded',
                    timeout: 45000
                });
                console.log('✅ Đã kết nối thành công đến website SJC');
                break;
            } catch (gotoError) {
                retryCount++;
                console.log(`❌ Lần thử ${retryCount}/${maxRetries} thất bại: ${gotoError.message}`);
                
                if (retryCount >= maxRetries) {
                    throw new Error(`Không thể kết nối đến SJC website sau ${maxRetries} lần thử: ${gotoError.message}`);
                }
                
                console.log('⏳ Chờ 5 giây trước khi thử lại...');
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }

        // Chờ bảng giá vàng load (just wait for it to exist, not be visible)
        await page.waitForSelector('table.sjc-table-show-price', { timeout: 15000 });

        console.log('📊 Đang cào dữ liệu Miền Bắc...');

        // Scroll từ từ xuống để trigger lazy loading
        console.log('📜 Scroll từ từ xuống trang để load dữ liệu...');
        await page.evaluate(async () => {
            const distance = 100;
            const delay = 100;
            
            while (document.scrollingElement.scrollTop + window.innerHeight < document.scrollingElement.scrollHeight) {
                document.scrollingElement.scrollBy(0, distance);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        });

        // Chờ dữ liệu load sau khi scroll
        console.log('⏳ Chờ dữ liệu load sau khi scroll...');
        await page.waitForTimeout(3000);
        
        // Try to wait for table content to be populated
        try {
            await page.waitForFunction(() => {
                const table = document.querySelector('table.sjc-table-show-price tbody');
                return table && table.querySelectorAll('tr').length > 0;
            }, { timeout: 10000 });
        } catch (error) {
            console.log('⚠️ Table content may not be fully loaded, continuing anyway...');
        }

        // Debug - kiểm tra tất cả các table
        const allTables = await page.evaluate(() => {
            const tables = document.querySelectorAll('table');
            return Array.from(tables).map((table, index) => ({
                index,
                className: table.className,
                innerHTML: table.innerHTML.substring(0, 200)
            }));
        });
        console.log('📋 All tables found:', allTables.length);
        allTables.forEach(table => {
            console.log(`Table ${table.index}: class="${table.className}"`);
            if (table.className === 'sjc-table-show-price') {
                console.log(`Gold table content: ${table.innerHTML}`);
            }
        });

        // Cào dữ liệu Miền Bắc
        const mienBacData = await page.evaluate(() => {
            // Try multiple selectors
            let rows = [];
            const tbody = document.querySelector('table.sjc-table-show-price tbody');
            if (tbody && tbody.querySelectorAll('tr').length > 0) {
                rows = Array.from(tbody.querySelectorAll('tr'));
                console.log(`📋 Found ${rows.length} rows in tbody`);
            } else {
                const fullTable = document.querySelector('table.sjc-table-show-price');
                if (fullTable) {
                    rows = Array.from(fullTable.querySelectorAll('tr'));
                    console.log(`📋 Found ${rows.length} rows in full table`);
                } else {
                    console.log('❌ No table found');
                    return [];
                }
            }
            
            const result = [];
            let isCapturingMienBac = false;

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const cells = row.querySelectorAll('td');
                
                // Kiểm tra nếu là header vùng miền (có colspan="3")
                if (cells.length === 1 && cells[0].getAttribute('colspan') === '3') {
                    const regionText = cells[0].textContent.trim();
                    console.log(`🏷️ Dòng ${i}: Found region: "${regionText}"`);
                    
                    if (regionText === 'Miền Bắc') {
                        console.log('✅ Bắt đầu capture Miền Bắc');
                        isCapturingMienBac = true;
                        continue;
                    } else if (isCapturingMienBac) {
                        console.log('🛑 Dừng capture khi gặp vùng khác');
                        // Dừng khi gặp vùng khác sau Miền Bắc
                        break;
                    }
                }
                // Kiểm tra nếu là dòng dữ liệu giá vàng
                else if (cells.length === 3 && isCapturingMienBac) {
                    const goldType = cells[0].textContent.trim();
                    const buyPrice = cells[1].textContent.trim().replace(/,/g, '');
                    const sellPrice = cells[2].textContent.trim().replace(/,/g, '');
                    
                    console.log(`💰 Dòng ${i}: "${goldType}" - Mua: "${buyPrice}" - Bán: "${sellPrice}"`);
                    
                    // Chỉ lấy dữ liệu hợp lệ
                    if (goldType && buyPrice && sellPrice && 
                        !isNaN(buyPrice) && !isNaN(sellPrice)) {
                        console.log(`✅ Dữ liệu hợp lệ, thêm vào kết quả`);
                        result.push({
                            goldType: goldType,
                            buyPrice: buyPrice,
                            sellPrice: sellPrice,
                            buyPriceFormatted: cells[1].textContent.trim(),
                            sellPriceFormatted: cells[2].textContent.trim(),
                            region: 'Miền Bắc',
                            scrapedAt: new Date().toISOString()
                        });
                    } else {
                        console.log(`❌ Dữ liệu không hợp lệ`);
                    }
                }
            }

            return result;
        });

        console.log(`✅ Đã cào được ${mienBacData.length} sản phẩm từ Miền Bắc`);
        return mienBacData;

    } catch (error) {
        console.error('❌ Lỗi khi cào dữ liệu:', error.message);
        throw error;
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

async function generateMienBacTableRows() {
    try {
        const data = await scrapeMienBacGoldPrices();
        
        if (!data || data.length === 0) {
            return '<tr><td colspan="3">Miền Bắc</td></tr><tr><td colspan="3">Không có dữ liệu</td></tr>';
        }

        // Tạo HTML rows
        let htmlRows = '<tr><td colspan="3">Miền Bắc</td></tr>\n';
        
        data.forEach(item => {
            htmlRows += `<tr><td>${item.goldType}</td><td>${item.buyPriceFormatted}</td><td>${item.sellPriceFormatted}</td></tr>\n`;
        });

        return htmlRows;

    } catch (error) {
        console.error('❌ Lỗi khi tạo HTML rows:', error.message);
        return '<tr><td colspan="3">Miền Bắc</td></tr><tr><td colspan="3">Lỗi khi lấy dữ liệu</td></tr>';
    }
}

async function updateTableWithMienBacData(existingTableHTML) {
    try {
        const mienBacRows = await generateMienBacTableRows();
        
        // Tìm và thay thế phần Miền Bắc trong bảng hiện tại
        const mienBacRegex = /<tr><td colspan="3">Miền Bắc<\/td><\/tr>[\s\S]*?(?=<tr><td colspan="3">(?!Miền Bắc)|<\/tbody>)/;
        
        if (mienBacRegex.test(existingTableHTML)) {
            // Thay thế dữ liệu Miền Bắc hiện tại
            return existingTableHTML.replace(mienBacRegex, mienBacRows);
        } else {
            // Thêm dữ liệu Miền Bắc vào cuối tbody
            return existingTableHTML.replace('</tbody>', mienBacRows + '</tbody>');
        }

    } catch (error) {
        console.error('❌ Lỗi khi cập nhật bảng:', error.message);
        return existingTableHTML;
    }
}

async function getSJCGoldPrice() {
    try {
        const data = await scrapeMienBacGoldPrices();
        const sjcGold = data.find(item => item.goldType.includes('SJC 1L'));
        
        if (sjcGold) {
            return {
                buyPrice: parseInt(sjcGold.buyPrice),
                sellPrice: parseInt(sjcGold.sellPrice),
                buyPriceFormatted: sjcGold.buyPriceFormatted,
                sellPriceFormatted: sjcGold.sellPriceFormatted,
                timestamp: sjcGold.scrapedAt
            };
        }
        
        throw new Error('Không tìm thấy giá vàng SJC 1L');
    } catch (error) {
        console.error('❌ Lỗi khi lấy giá vàng SJC:', error.message);
        throw error;
    }
}

