import puppeteer from "puppeteer";

export async function scrapeMienBacGoldPrices() {
    let browser;
    
    try {
        // Khởi tạo browser
        browser = await puppeteer.launch({
            headless: 'new',
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
                '--single-process',
                '--disable-extensions',
                '--disable-plugins',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-default-apps',
                '--disable-translate',
                '--disable-device-discovery-notifications',
                '--disable-software-rasterizer',
                '--disable-background-networking',
                '--no-default-browser-check',
                '--no-pings',
                '--disable-logging',
                '--disable-permissions-api',
                '--ignore-ssl-errors',
                '--ignore-certificate-errors',
                '--allow-running-insecure-content',
                '--disable-component-extensions-with-background-pages',
                '--disable-client-side-phishing-detection'
            ],
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
            ignoreDefaultArgs: ['--disable-extensions'],
            timeout: 60000
        });

        const page = await browser.newPage();
        
        // Set user agent để tránh bị block
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Set viewport
        await page.setViewport({ width: 1366, height: 768 });
        
        // Set extra headers
        await page.setExtraHTTPHeaders({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'vi-VN,vi;q=0.8,en-US;q=0.5,en;q=0.3',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        });
        
        console.log('🚀 Đang truy cập website SJC...');
        
        // Truy cập website SJC
        await page.goto('https://sjc.com.vn/', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // Chờ bảng giá vàng load
        await page.waitForSelector('table.sjc-table-show-price tbody', { timeout: 15000 });

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
        await new Promise(resolve => setTimeout(resolve, 5000));

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
            const table = document.querySelector('table.sjc-table-show-price tbody');
            if (!table) {
                console.log('❌ Không tìm thấy table tbody');
                return [];
            }

            const rows = Array.from(table.querySelectorAll('tr'));
            console.log(`📋 Tìm thấy ${rows.length} dòng trong bảng`);
            
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
            await browser.close();
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

