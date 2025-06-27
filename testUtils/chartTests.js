import { chartManager } from "../public/js/chartMan.js";
import { getChartData } from "../public/js/chartDataGrabber.js";
import { attachAllToDiscord } from "../public/js/reporter.js";
///////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////
const dummyData = {
  snapshotDate: "2025-06-16",
  userMobos: {
    "X870E Nova WiFi": { socket: "AM5", maker: "AMD", count: 65, signups: 35 },
    "X870E Taichi": { socket: "AM5", maker: "AMD", count: 33, signups: 18 },
    "X870E Taichi Lite": {
      socket: "AM5",
      maker: "AMD",
      count: 16,
      signups: 12,
    },
    "X870 Pro RS WiFi": { socket: "AM5", maker: "AMD", count: 9, signups: 3 },
    "B650 Steel Legend WiFi": {
      socket: "AM5",
      maker: "AMD",
      count: 8,
      signups: 4,
    },
    "B850 Riptide WiFi": { socket: "AM5", maker: "AMD", count: 7, signups: 1 },
    "B650M-HDV/M.2": { socket: "AM5", maker: "AMD", count: 7, signups: 3 },
    "X870 Pro RS": { socket: "AM5", maker: "AMD", count: 7, signups: 5 },
    "X670E Steel Legend": { socket: "AM5", maker: "AMD", count: 6, signups: 1 },
    "X870 Steel Legend WiFi": {
      socket: "AM5",
      maker: "AMD",
      count: 6,
      signups: 2,
    },
    "B650E Steel Legend WiFi": {
      socket: "AM5",
      maker: "AMD",
      count: 5,
      signups: 1,
    },
    "X670E PG Lightning": { socket: "AM5", maker: "AMD", count: 5, signups: 2 },
    "B650I Lightning WiFi": {
      socket: "AM5",
      maker: "AMD",
      count: 5,
      signups: 3,
    },
    "X870 Riptide WiFi": { socket: "AM5", maker: "AMD", count: 5, signups: 3 },
    "B850I Lightning WiFi": {
      socket: "AM5",
      maker: "AMD",
      count: 5,
      signups: 4,
    },
    "B850 Steel Legend WiFi": {
      socket: "AM5",
      maker: "AMD",
      count: 5,
      signups: 2,
    },
    "B650M Pro RS": { socket: "AM5", maker: "AMD", count: 4, signups: 0 },
    "B850 LiveMixer WiFi": {
      socket: "AM5",
      maker: "AMD",
      count: 3,
      signups: 1,
    },
    "B850M Pro RS WiFi": { socket: "AM5", maker: "AMD", count: 3, signups: 0 },
    "B650E PG-ITX WiFi": { socket: "AM5", maker: "AMD", count: 3, signups: 1 },
    "B650M Pro RS WiFi": { socket: "AM5", maker: "AMD", count: 3, signups: 1 },
    "B850 Pro RS": { socket: "AM5", maker: "AMD", count: 3, signups: 3 },
    "B650E PG Riptide WiFi": {
      socket: "AM5",
      maker: "AMD",
      count: 3,
      signups: 2,
    },
    "B650E Taichi Lite": { socket: "AM5", maker: "AMD", count: 3, signups: 3 },
    "B650 PG Lightning": { socket: "AM5", maker: "AMD", count: 3, signups: 3 },
    "B850M Steel Legend WiFi": {
      socket: "AM5",
      maker: "AMD",
      count: 2,
      signups: 1,
    },
    "B850M Pro-A": { socket: "AM5", maker: "AMD", count: 2, signups: 0 },
    "B650M PG Riptide": { socket: "AM5", maker: "AMD", count: 2, signups: 0 },
    "X670E Pro RS": { socket: "AM5", maker: "AMD", count: 2, signups: 1 },
    "B850 Pro-A WiFi": { socket: "AM5", maker: "AMD", count: 2, signups: 1 },
    "B850 Pro-A": { socket: "AM5", maker: "AMD", count: 2, signups: 2 },
    "B850M Riptide WiFi": { socket: "AM5", maker: "AMD", count: 2, signups: 2 },
    "X570 Steel Legend WiFi ax": {
      socket: "AM4",
      maker: "AMD",
      count: 1,
      signups: 0,
    },
    "A620M Pro RS WiFi": { socket: "AM5", maker: "AMD", count: 1, signups: 0 },
    "Z790 Taichi Lite": {
      socket: "1700",
      maker: "Intel",
      count: 1,
      signups: 0,
    },
    "A620M-HDV/M.2+": { socket: "AM5", maker: "AMD", count: 1, signups: 0 },
    "B850 Pro RS WiFi": { socket: "AM5", maker: "AMD", count: 1, signups: 1 },
    "X570 Creator": { socket: "AM4", maker: "AMD", count: 1, signups: 0 },
    "Z890 Taichi AQUA": {
      socket: "1851",
      maker: "Intel",
      count: 1,
      signups: 0,
    },
    "B660 Pro RS": { socket: "1700", maker: "Intel", count: 1, signups: 0 },
    "X670E Taichi": { socket: "AM5", maker: "AMD", count: 1, signups: 0 },
    "X670E Taichi Carrara": {
      socket: "AM5",
      maker: "AMD",
      count: 1,
      signups: 0,
    },
    "Z690 Taichi": { socket: "1700", maker: "Intel", count: 1, signups: 1 },
    "Z790 PG Lightning": {
      socket: "1700",
      maker: "Intel",
      count: 1,
      signups: 0,
    },
    "X570 Phantom Gaming 4": {
      socket: "AM4",
      maker: "AMD",
      count: 1,
      signups: 0,
    },
    "Z890 Pro-A WiFi": { socket: "1851", maker: "Intel", count: 1, signups: 0 },
    "Z890 Riptide WiFi": {
      socket: "1851",
      maker: "Intel",
      count: 1,
      signups: 0,
    },
    "Z890 LiveMixer WiFi": {
      socket: "1851",
      maker: "Intel",
      count: 1,
      signups: 1,
    },
    "Z690 Taichi Razer Edition": {
      socket: "1700",
      maker: "Intel",
      count: 1,
      signups: 1,
    },
    "B760M PG Riptide": {
      socket: "1700",
      maker: "Intel",
      count: 1,
      signups: 1,
    },
    "B650E Taichi": { socket: "AM5", maker: "AMD", count: 1, signups: 1 },
    "B850M-X WiFi": { socket: "AM5", maker: "AMD", count: 1, signups: 1 },
    "B650M PG Lightning WiFi": {
      socket: "AM5",
      maker: "AMD",
      count: 1,
      signups: 1,
    },
    "B650M PG Riptide WiFi": {
      socket: "AM5",
      maker: "AMD",
      count: 1,
      signups: 1,
    },
    "Z890 Taichi OCF": { socket: "1851", maker: "Intel", count: 1, signups: 1 },
    "B850M Pro-A WiFi": { socket: "AM5", maker: "AMD", count: 1, signups: 1 },
    "X570 Taichi": { socket: "AM4", maker: "AMD", count: 1, signups: 1 },
  },
  weeklyUpdates: {
    "Z890 Taichi AQUA": {
      helddate: "2025/4/1",
      heldversion: "2.29",
      notified: 1,
    },
    "Z890 Pro-A WiFi": {
      helddate: "2025/3/26",
      heldversion: "2.25",
      notified: 1,
    },
    "Z890 Riptide WiFi": {
      helddate: "2025/3/27",
      heldversion: "2.24",
      notified: 1,
    },
    "H810M-X": { helddate: "2025/3/28", heldversion: "1.10", notified: 0 },
    "H810M-X WiFi": { helddate: "2025/3/28", heldversion: "1.10", notified: 0 },
    "Z890I Nova WiFi": {
      helddate: "2025/3/28",
      heldversion: "2.26",
      notified: 0,
    },
    "B860I WiFi": { helddate: "2025/4/1", heldversion: "1.21", notified: 0 },
    "B860M LiveMixer WiFi": {
      helddate: "2025/3/26",
      heldversion: "1.11",
      notified: 0,
    },
    "B860M Lightning WiFi": {
      helddate: "2025/3/31",
      heldversion: "1.19",
      notified: 0,
    },
    "Z890 Lightning WiFi": {
      helddate: "2025/3/26",
      heldversion: "2.25",
      notified: 0,
    },
    "B860 Lightning WiFi": {
      helddate: "2025/4/1",
      heldversion: "1.25",
      notified: 0,
    },
    "Z890 Pro RS WiFi White": {
      helddate: "2025/3/26",
      heldversion: "2.25",
      notified: 0,
    },
    "Z890 Pro RS WiFi": {
      helddate: "2025/3/26",
      heldversion: "2.25",
      notified: 0,
    },
    "Z890 Taichi OCF": {
      helddate: "2025/3/27",
      heldversion: "2.28",
      notified: 0,
    },
    "Z890 Steel Legend WiFi": {
      helddate: "2025/3/26",
      heldversion: "2.25",
      notified: 0,
    },
    "Z890 Pro RS": { helddate: "2025/3/26", heldversion: "2.25", notified: 0 },
    "Z890 Pro-A": { helddate: "2025/3/26", heldversion: "2.25", notified: 0 },
    "Z890 LiveMixer WiFi": {
      helddate: "2025/3/27",
      heldversion: "2.24",
      notified: 0,
    },
    "Z890M Riptide WiFi": {
      helddate: "2025/3/27",
      heldversion: "2.24",
      notified: 0,
    },
    "B860 LiveMixer WiFi": {
      helddate: "2025/3/27",
      heldversion: "1.28",
      notified: 0,
    },
    "B860 Steel Legend WiFi": {
      helddate: "2025/4/1",
      heldversion: "1.25",
      notified: 0,
    },
    "B860 Pro RS WiFi": {
      helddate: "2025/4/1",
      heldversion: "1.17",
      notified: 0,
    },
    "B860 Pro RS": { helddate: "2025/4/1", heldversion: "1.17", notified: 0 },
    "B860 Pro-A WiFi": {
      helddate: "2025/4/1",
      heldversion: "1.17",
      notified: 0,
    },
    "B860 Pro-A": { helddate: "2025/4/1", heldversion: "1.17", notified: 0 },
    "B860M Steel Legend WiFi": {
      helddate: "2025/3/31",
      heldversion: "1.19",
      notified: 0,
    },
  },
};
///////////////////////////////////////////////////////////////////////////////////
async function updateDummyData() {
  // calls getChartData() (from chartMan.js) and console.logs
  // You'll have to manually update the data
  const result = await getChartData();
  console.log(result);
}
async function chartManagerResult() {
  // tests chartManager with above dummyData and shows the return
  // remove the dummy parameter if wanting to use real data
  const result = await chartManager(dummyData);
  console.log(result);
}

export async function fullTestAllCharts() {
  attachAllToDiscord().catch((err) => {
    console.error(`Error attaching charts to Discord: ${err.message}`);
  });
}

//fullTestAllCharts();
chartManagerResult();
//updateDummyData();
