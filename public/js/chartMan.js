import sql from "./db.js";

///////////////////////////////////////////////////////////
// pull db data and process (joins, desired values etc)
// This is a core, large data object from which you can pluck what you want
// See below for example of current output
export async function getChartData() {
  try {
    const results = await sql`
		SELECT 
		  u.mobo,
		  m.socket,
		  m.maker,
		  COUNT(*) AS count
		FROM 
		  users u
		JOIN 
		  models m ON u.mobo = m.model
		WHERE 
		  u.mobo != 'dummy'
		GROUP BY 
		  u.mobo, m.socket, m.maker
		ORDER BY 
		  COUNT(*) DESC;
	  `;

    // Convert to a plain JavaScript object with mobo as the key
    const moboObject = (results.rows || results).reduce((acc, row) => {
      acc[row.mobo] = {
        socket: row.socket,
        maker: row.maker,
        count: row.count,
      };
      return acc;
    }, {});

    // Create the final response object with snapshotDate
    const responseObject = {
      snapshotDate: new Date().toISOString().split("T")[0], // Format: YYYY-MM-DD
      userMobos: moboObject,
    };

    return responseObject;
  } catch (error) {
    console.error("Error fetching usermobo data:", error);
  }
  // Current output:
  // {
  // 	"snapshotDate": "2025-03-24",
  // 	"userMobos": {
  // 	  "z890 awesome mobo": { "socket": "1800", "maker": "Intel", "count": 12 },
  // 	  "x870 awesome mobo": { "socket": "AM4", "maker": "AMD", "count": 18 },
  // 	  // ... more items
  // 	}
  //   }
}
///////////////////////////////////////////////////////////
// Re-usable chart configuration options
//
// Remember: we're using Chart.js VERSION 2 not 4 anymore (due to outLabeled plugin)
// Also remember: the GENERATEPLACEHOLDER functions need their colors done separately

const chartConfig = {
  socketColors: {
    1851: "#0273eb",
    AM5: "#cc0202",
    1700: "#004b9c",
    AM4: "#940000",
  },

  datasetsArray: {
    borderColor: "black",
    borderWidth: 0.5,
  },

  options: {
    legend: {
      // v2: 'legend' is directly under options
      display: true,
      labels: {
        generateLabels: "__GENERATE_LABELS_PLACEHOLDER__",
        fontColor: "black", // v2: 'color' is 'fontColor'
        borderColor: "black",
        borderWidth: 1,
      },
    },
    title: {
      // v2: 'title' is directly under options
      display: true,
      fontColor: "black", // v2: 'color' is 'fontColor'
      fontSize: 20, // v2: 'font.size' is 'fontSize'
    },
    plugins: {
      backgroundImageUrl:
        "https://www.asrockbioschecker.link/images/graphLogo.png",
      //No longer used since we're using QuickChart's watermark feature
    },
  },
};
///////////////////////////////////////////////////////////
// Sadly, functions within the chart object must be stringified
// The easiest way is to literally deliver an object with quotes around it, to QuickChart
// however, since we dynamically create the charts with colors and functions etc
// that doesn't work, so we have to use this function to replace the in-object function
// with a stringified version of the function
// ...... for FUCKS sake, computers.
//
// Currently it's only for the legend function.
// If we add more, we need (1) a 'object' for that (like for legend colors below)
// (2) a UNIQUE _PLACEHOLDER_ in the chart object
// (3) actual replacement will be handled by the map below

// Placeholder map for function replacements
const placeholderReplacements = {
  __GENERATE_LABELS_PLACEHOLDER__: (chart) => {
    return [
      {
        text: "AM5",
        fillStyle: "#cc0202",
        strokeStyle: "#black",
        lineWidth: 1,
        hidden: false,
        index: 0,
      },
      {
        text: "AM4",
        fillStyle: "#940000",
        strokeStyle: "#black",
        lineWidth: 1,
        hidden: false,
        index: 1,
      },
      {
        text: "LGA 1851",
        fillStyle: "#0273eb",
        strokeStyle: "#black",
        lineWidth: 1,
        hidden: false,
        index: 2,
      },
      {
        text: "LGA 1700",
        fillStyle: "#004b9c",
        strokeStyle: "#black",
        lineWidth: 1,
        hidden: false,
        index: 3,
      },
    ];
  },
};

// Replaces the chart object placeholders with their intended functions
function createChartString(chartObject) {
  let chartString = JSON.stringify(chartObject);

  for (const placeholder in placeholderReplacements) {
    chartString = chartString.replace(
      `"${placeholder}"`,
      placeholderReplacements[placeholder].toString()
    );
  }

  return chartString;
}
///////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////

// Function to create a bar chart based on mobo counts
function createMoboBarChart(data) {
  const moboNames = Object.keys(data.userMobos);
  const counts = moboNames.map((mobo) => data.userMobos[mobo].count);
  const barColors = moboNames.map(
    (mobo) => chartConfig.socketColors[data.userMobos[mobo].socket] || "#999999"
  );

  const title = "Motherboard Distribution";

  // Calculate dynamic height based on the number of labels.
  const labelCount = moboNames.length;
  const averageLabelHeight = 15; // Adjust this value as needed.
  const dynamicHeight = labelCount * averageLabelHeight;
  const minHeight = 420; // Minimum height to ensure readability.
  const calculatedHeight = Math.max(dynamicHeight, minHeight);

  return {
    calculatedHeight: calculatedHeight,
    type: "horizontalBar",
    data: {
      labels: moboNames,
      datasets: [
        {
          ...chartConfig.datasetsArray, // Use the reusable datasetsArray (mostly just border color)
          label: `${title}`,
          data: counts,
          backgroundColor: barColors,
        },
      ],
    },
    options: {
      ...chartConfig.options, // Using earlier defined options (see above)
      title: {
        // Override title text, keep other options
        ...chartConfig.options.title,
        text: `${title} (as of ${data.snapshotDate})`,
      },
      scales: {
        xAxes: [
          // v2: 'x' is 'xAxes', and an array
          {
            ticks: {
              fontColor: "black", // v2: 'color' is 'fontColor'
            },
            gridLines: {
              // v2: 'grid' is 'gridLines'
              display: true,
              zeroLineWidth: 1,
              zeroLineColor: "black",
            },
          },
        ],
        yAxes: [
          // v2: 'y' is 'yAxes', and an array
          {
            ticks: {
              fontColor: "black", // v2: 'color' is 'fontColor'
            },
            gridLines: {
              // v2: 'grid' is 'gridLines'
              display: false,
            },
          },
        ],
      },
      plugins: {
        //...chartConfig.options.plugins,
        // no longer using 'plugins' at all due to watermark instead
        datalabels: {
          anchor: "end",
          align: "end",
          color: "black",
        },
      },
    },
  };
}

function createSocketPieChart(data) {
  function transformMoboDataForPie(data) {
    const socketCounts = {};
    for (const moboName in data.userMobos) {
      const mobo = data.userMobos[moboName];
      const count = parseInt(mobo.count, 10); // Parse count as integer
      if (!isNaN(count)) {
        socketCounts[mobo.socket] = (socketCounts[mobo.socket] || 0) + count;
      }
    }
    return { socketCounts };
  }

  const title = "Socket Distribution";

  const transformedData = transformMoboDataForPie(data);
  const socketLabels = Object.keys(transformedData.socketCounts);
  const socketData = socketLabels.map(
    (socket) => transformedData.socketCounts[socket]
  );
  const socketColors = socketLabels.map(
    (socket) => chartConfig.socketColors[socket]
  );

  return {
    calculatedHeight: 370,
    type: "outlabeledPie",
    data: {
      labels: socketLabels,
      datasets: [
        {
          ...chartConfig.datasetsArray, // Use the reusable datasetsArray (mostly just border color)
          label: `${title}`,
          data: socketData,
          backgroundColor: socketColors,
        },
      ],
    },
    options: {
      ...chartConfig.options, // Using earlier defined options (see above)
      title: {
        // Override title text, keep other options
        ...chartConfig.options.title,
        text: `${title} (as of ${data.snapshotDate})`,
      },
      rotation: -0.2 * Math.PI,
      plugins: {
        //...chartConfig.options.plugins,
        // no longer using 'plugins' at all due to watermark instead
        // datalabels: {
        //   color: "white",
        // //use this for V4 without outLabels
        // }
        outlabels: {
          borderColor: "black",
          lineColor: "black",
          lineWidth: 0.8,
          borderRadius: 1,
          borderWidth: 0.5,
          color: "white",
          display: true,
          padding: 2.5,
          stretch: 40, // The length between chart and Label
          text: "%p (%v)",
        },
      },
    },
  };
}
///////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////
//shortens the chart URL for Discord's 2000 char limit
export async function getShortUrl(chartString, height, ratio = 1.4) {
  const quickchartUrl = "https://quickchart.io/chart/create";

  const width = Math.round(height * ratio);

  const postData = {
    version: "2",
    chart: chartString, // Send the chart as a string
    backgroundColor: "white",
    width: width || 600,
    height: height || 370,
    //dynamic sizing (height) based on number of items, and double-dynamic (width) based on that
    //relative to ratio and chart type
  };

  try {
    const response = await fetch(quickchartUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(postData),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.url; // Return the short URL
  } catch (error) {
    console.error("Error:", error);
    return null;
  }
}
///////////////////////////////////////////////////////////
async function processChart(data, createChartFunction, ratio) {
  // performs processing, shortening, and watermarking of the chart
  // done individually now, and called en-masse by chartManager
  // More of a factory, I guess.
  const chartObject = createChartFunction(data);
  const chartString = createChartString(chartObject);
  const chartUrl = await getShortUrl(chartString, chartObject.calculatedHeight, ratio);
  const encodedChartUrl = encodeURIComponent(chartUrl);

  const watermarkConfig = {
    url: "https://www.asrockbioschecker.link/images/watermark.png",
    ratio: 0.2,
    opacity: 0.5,
    position: "bottomRight",
  };

  const encodedWatermark = encodeURIComponent(watermarkConfig.url);

  return `https://quickchart.io/watermark?mainImageUrl=${encodedChartUrl}&markImageUrl=${encodedWatermark}&markRatio=${watermarkConfig.ratio}&opacity=${watermarkConfig.opacity}&position=${watermarkConfig.position}`;
}


export async function chartManager(data) {
  // Manager to call processChart for each chart configuration
  // and sends results list - which will get posted one-by-one to discord by Reporter

  // Uses dummyData if provided, else it fetches
  if (!data) {
    data = await getChartData();
  }

  // Any new chart configurations should be added here
  // Remember to give them a 'calculatedHeight'
  const chartConfigs = [
    {
      name: "moboBarChart",
      createChartFunction: createMoboBarChart,
      ratio: 1.6,
    },
    {
      name: "socketPieChart",
      createChartFunction: createSocketPieChart,
      ratio: 1.4,
    },
    // Add more chart configurations here...
  ];

  const chartPromises = chartConfigs.map((config) =>
    processChart(data, config.createChartFunction, config.ratio)
  );

  const chartResults = await Promise.all(chartPromises);

  const finalResults = {};
  chartConfigs.forEach((config, index) => {
    finalResults[`final${config.name.charAt(0).toUpperCase() + config.name.slice(1)}Watermarked`] = chartResults[index];
  });

  return finalResults;
}
///////////////////////////////////////////////////////////