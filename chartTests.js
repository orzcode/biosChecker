import { chartManager, getShortUrl, getChartData } from "./public/js/chartMan.js";
import { sendChartToDiscord, sendAllChartsToDiscord } from "./public/js/reporter.js";

///////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////
const dummyData = 
  {
    snapshotDate: '2025-03-28',
    userMobos: {
      'X870E Nova WiFi': { socket: 'AM5', maker: 'AMD', count: '23' },
      'X870E Taichi': { socket: 'AM5', maker: 'AMD', count: '11' },
      'X870 Pro RS WiFi': { socket: 'AM5', maker: 'AMD', count: '5' },
      'B650 Steel Legend WiFi': { socket: 'AM5', maker: 'AMD', count: '4' },
      'X870 Steel Legend WiFi': { socket: 'AM5', maker: 'AMD', count: '4' },
      'B650M Pro RS': { socket: 'AM5', maker: 'AMD', count: '3' },
      'B850 Riptide WiFi': { socket: 'AM5', maker: 'AMD', count: '3' },
      'B850 Steel Legend WiFi': { socket: 'AM5', maker: 'AMD', count: '3' },
      'X870 Riptide WiFi': { socket: 'AM5', maker: 'AMD', count: '2' },
      'B850M Pro RS WiFi': { socket: 'AM5', maker: 'AMD', count: '2' },
      'X870 Pro RS': { socket: 'AM5', maker: 'AMD', count: '2' },
      'X870E Taichi Lite': { socket: 'AM5', maker: 'AMD', count: '2' },
      'Z790 PG Lightning': { socket: '1700', maker: 'Intel', count: '1' },
      'Z890 Pro-A WiFi': { socket: '1851', maker: 'Intel', count: '1' },
      'Z890 Riptide WiFi': { socket: '1851', maker: 'Intel', count: '1' },
      'Z890 Taichi AQUA': { socket: '1851', maker: 'Intel', count: '1' },
      'B650E PG Riptide WiFi': { socket: 'AM5', maker: 'AMD', count: '1' },
      'B650I Lightning WiFi': { socket: 'AM5', maker: 'AMD', count: '1' },
      'B660 Pro RS': { socket: '1700', maker: 'Intel', count: '1' },
      'B850 Pro-A WiFi': { socket: 'AM5', maker: 'AMD', count: '1' },
      'B850I Lightning WiFi': { socket: 'AM5', maker: 'AMD', count: '1' },
      'X570 Creator': { socket: 'AM4', maker: 'AMD', count: '1' },
      'X570 Phantom Gaming 4': { socket: 'AM4', maker: 'AMD', count: '1' },
      'X670E PG Lightning': { socket: 'AM5', maker: 'AMD', count: '1' },
      'X670E Steel Legend': { socket: 'AM5', maker: 'AMD', count: '1' },
      'X670E Taichi': { socket: 'AM5', maker: 'AMD', count: '1' },
      'X670E Taichi Carrara': { socket: 'AM5', maker: 'AMD', count: '1' }
    }
  }
///////////////////////////////////////////////////////////////////////////////////
async function updateDummyData() {
  // calls getChartData() (from chartMan.js) and console.logs
  // You'll have to manually update the data
  const result = await getChartData();
  console.log(result);
}
async function chartManagerResult() {
  // tests chartManager with above dummyData and shows the return
  const result = await chartManager(dummyData);
  //console.log(result);
}

export async function fullTestAllCharts() {
  //uses dummy data as per function here
  const chartUrlsObject = await chartManagerResult();

  const chartUrls = Object.values(chartUrlsObject);
  console.log(chartUrls);
  try {
    const webhookUrl = process.env.DISCORD_WEBHOOK_STATSCHARTS;
    const today = new Date().toISOString().split("T")[0];

    // Create an array of embed objects for each chart URL
    const embeds = chartUrls.map((chartUrl) => ({
      image: { url: chartUrl }
    }));

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `Statistics as of ${today}`,
        embeds: embeds,
      }),
    });

    console.log(`All QuickChart img URLs sent to Discord`);
  } catch (error) {
    console.error(`Error sending QuickChart img URLs to Discord: ${error}`);
  }
}
async function testSendCharts() {
  // calls the final sendAllChartsToDiscord() (from reporter.js)
  // which calls chartManager() - which returns and obj with each chart URL
  // and then calls sendChartToDiscord() (from reporter.js) for each chart URL
  try {
    await sendAllChartsToDiscord();
    console.log("Charts sent successfully!");
  } catch (error) {
    console.error("Error sending charts:", error);
  }
}



//fullTestAllCharts();
//testSendCharts();
chartManagerResult()

//updateDummyData();
