// ****************************************
// Globals
// ****************************************
var geographyList = ["434", "372", "232"],        // default list of neighborhoods if none passed
    theData,
    theMetadata, // global for fetched raw data
    metricConfig,
    model = {};

_.templateSettings.variable = "rc";


// ****************************************
// get the year(s) for each metric
// ****************************************
function getYear(m) {
    switch (metricConfig[m].type) {
        case 'sum':
        case 'normalize':
            return _.without(_.keys(theData['r' + metricConfig[m].metric][0]), 'id');
            break;
        case 'mean':
            return _.without(_.keys(theData['n' + metricConfig[m].metric][0]), 'id');
            break;
    }
}

// ****************************************
// set model variable as needed from data type
// ****************************************
function setModel(metricId) {
    var model = {
        "metricId": metricId,
        "metric": "",
        "metricRaw": "",
        "metricDenominator": "",
    };
    
    switch (metricConfig[metricId].type) {
        case 'sum':
            model.metric = theData['r' + metricConfig[metricId].metric];
            break;
        case 'mean':
            model.metric = theData['n' + metricConfig[metricId].metric];
            if (metricConfig[metricId].raw_label) {
                model.metricRaw = theData['r' + metricConfig[metricId].metric];
            }
            break;
        case 'normalize':
            model.metricRaw = theData['r' + metricConfig[metricId].metric];
            model.metricDenominator = theData['d' + metricConfig[metricId].metric];
            var calcMetric = $.extend(true, {}, model.metricRaw);
            model.metric = calcMetric;
            break;
    }
    
    return model;
}


// ****************************************
// Create charts
// ****************************************
function createCharts() {
    var colors = ["#5C2B2D", "#7A9993", "#959BA9", "#FAFBDD", "#C3DBDE"];

    // doughnut charts
    $(".chart-doughnut").each(function () {
        var data = [];
        var selector = $(this).data("selector");
        _.each($(this).data('chart').split(','), function (el, i) {
            var dataTypeKey = el;
            data.push({
                value: Number($(".data-" + el).data(selector)),
                color: colors[i],
                label: $(".label-" + el).data("val").replace('Race/Ethnicity - ', '')
            });
        });
        var ctx = document.getElementById($(this).prop("id")).getContext("2d");
        var chart = new Chart(ctx).Doughnut(data, {
            showTooltips: true,
            legendTemplate: '<% for (var i=0; i<segments.length; i++){%><span style="border-color:<%=segments[i].fillColor%>" class="title"><%if(segments[i].label){%><%=segments[i].label%><%}%></span><%}%>',
            tooltipTemplate: "<%= dataPretty(value, '" + dataTypeKey + "') %>",
            multiTooltipTemplate: "<%= dataPretty(value, '" + dataTypeKey + "') %>",
        });
        $("#" + $(this).prop("id") + "-legend").html(chart.generateLegend());
    });

    // bar charts
    $(".chart-bar").each(function () {
        // prep the data
        var data = {};
        var dataTypeKey = "";

        var datasets = [
            {
                fillColor: "rgba(151,187,205,0.5)",
                strokeColor: "rgba(151,187,205,0.8)",
                data: [],
                label: "Selected " + neighborhoodDescriptor + "s"
            },
            {
                fillColor: "rgba(220,220,220,0.5)",
                strokeColor: "rgba(220,220,220,0.8)",
                data: [],
                label: "County"
            }
        ];

        data.labels = $(this).data('labels').split(",");

        _.each($(this).data('chart').split(','), function (el) {
            datasets[0].data.push($(".data-" + el).data("selected-val"));
            datasets[1].data.push($(".data-" + el).data("county-val"));
            dataTypeKey = el;
        });

        if (!$.isNumeric(datasets[0].data[0])) {
            datasets.shift();
        }

        data.datasets = datasets;

        var ctx = document.getElementById($(this).prop("id")).getContext("2d");
        var chart = new Chart(ctx).Bar(data, {
            showTooltips: true,
            legendTemplate: '<% for (var i=0; i<datasets.length; i++){%><span class="title"  style="border-color:<%=datasets[i].strokeColor%>"><%if(datasets[i].label){%><%=datasets[i].label%><%}%></span><%}%>',
            scaleLabel: "<%= dataFormat(dataRound(Number(value), 2), '" + dataTypeKey + "') %>",
            tooltipTemplate: "<%if (label){%><%=label%>: <%}%><%= dataPretty(value, '" + dataTypeKey + "') %>",
            multiTooltipTemplate: "<%= dataPretty(value, '" + dataTypeKey + "') %>",
        });

        $("#" + $(this).prop("id") + "-legend").html(chart.generateLegend());

    });

    // line charts
    $(".chart-line").each(function () {
        var m = $(this).data("chart"),
            npaMean = [],
            countyMean = [];

        setModel(m);
        var keys = getYear(m);

        // stats
        _.each(keys, function (year) {
            countyMean.push(dataCrunch(year));
            npaMean.push(dataCrunch(year, geographyList));
            dataTypeKey = m;
        });

        // make sure selected stuff really has a value
        _.each(npaMean, function (el) {
            if (!$.isNumeric(el)) {
                npaMean = null;
            }
        });

        var data = {
            labels: [],
            datasets: [
                {
                    fillColor: "rgba(151,187,205,0.2)",
                    strokeColor: "rgba(151,187,205,1)",
                    pointColor: "rgba(151,187,205,1)",
                    pointStrokeColor: "#fff",
                    data: [],
                    label: "Selected " + neighborhoodDescriptor + "s"
                },
                {
                    fillColor: "rgba(220,220,220,0.2)",
                    strokeColor: "rgba(220,220,220,1)",
                    pointColor: "rgba(220,220,220,1)",
                    pointStrokeColor: "#fff",
                    data: [],
                    label: "County"
                }
            ]
        };

        _.each(countyMean, function (el, i) {
            data.labels.push(keys[i].replace("y_", ""));
            if (npaMean !== null) {
                data.datasets[0].data.push(Math.round(npaMean[i] * 10) / 10);
            }
            data.datasets[1].data.push(Math.round(el * 10) / 10);
        });

        // remove select mean if no values are there
        if (!npaMean || npaMean === null) {
            data.datasets.shift();
        }

        var ctx = document.getElementById($(this).prop("id")).getContext("2d");
        var chart = new Chart(ctx).Line(data, {
            showTooltips: true,
            legendTemplate: '<% for (var i=0; i<datasets.length; i++){%><span class="title"  style="border-color:<%=datasets[i].strokeColor%>"><%if(datasets[i].label){%><%=datasets[i].label%><%}%></span><%}%>',
            scaleLabel: "<%= dataFormat(dataRound(Number(value), 2), '" + m + "') %>",
            tooltipTemplate: "<%if (label){%><%=label%>: <%}%><%= dataPretty(value, '" + dataTypeKey + "') %>",
            multiTooltipTemplate: "<%= dataPretty(value, '" + dataTypeKey + "') %>",
        });

        if ($("#" + $(this).prop("id") + "-legend").length > 0) {
            $("#" + $(this).prop("id") + "-legend").html(chart.generateLegend());
        }
    });
}

// ****************************************
// Return the nth instance of a substring
// ****************************************
function GetSubstringIndex(str, substring, n) {
    var times = 0, index = null;
    while (times < n && index !== -1) {
        index = str.indexOf(substring, index + 1);
        times++;
    }
    return index;
}

// ****************************************
// Create the metric blocks and table values
// ****************************************

var featureIndex = 0;

/**
 * Parse the contents of a metadata html file (e.g. mPOP.html) and construct a table of metadata for display.
 *
 * @param metricId
 *   Metric ID (e.g. mPOP)
 * @param htmlData
 *   Contents of HTML metadata file for metric.
 * @returns metadata object which can be applied to the HTML template {{id: *, title: string, year: string, typeValues: string, about: string, important: string, additionalResources: string, selectedVal: string, selectedRaw: string, selectedNVal: string, countyVal: string, countyRaw: string, countyNVal: string}}
 */
function parseMetadataHTML(metricId, htmlData) {
    // Start populating tdata object for this metric.
    var tdata = {
        "id": metricId,
        "title": "",
        "year": "",
        "typeValues": "",
        "about": "",
        "important": "",
        "additionalResources": "",
        "selectedVal": "",
        "selectedRaw": "",
        "selectedNVal": "",
        "countyVal": "",
        "countyRaw": "",
        "countyNVal": ""
    };

    // Populate tdata object with metadata.
    metricTitle = htmlData.substring(GetSubstringIndex(htmlData, '</p>', 1), GetSubstringIndex(htmlData, '<p', 1) + 3);
    tdata.title = metricTitle;
    aboutHTML = htmlData.substring(GetSubstringIndex(htmlData, '</h3>', 2) + 5, GetSubstringIndex(htmlData, '<h3', 3));
    tdata.about = aboutHTML;
    importance = htmlData.substring(GetSubstringIndex(htmlData, '</p>', 2), GetSubstringIndex(htmlData, '<p', 2) + 3);
    tdata.important = importance;
    additionalResourcesHTML = "<table><thead></thead>" + htmlData.substring(GetSubstringIndex(htmlData, '</tbody>', 1) + 8, GetSubstringIndex(htmlData, '<tbody', 1)) + "</body>";

    var parser = new DOMParser();
    var parserDoc = parser.parseFromString(additionalResourcesHTML, "text/html");
    var tableTRs = parserDoc.getElementsByTagName("tr");
    var trTDs;
    var additionalResourceLink;
    additionalResourcesLinks = "";
    for (var i = 0; i < tableTRs.length; i++) {
        parserDoc = parser.parseFromString("<table><tr>" + tableTRs[i].innerHTML + "</tr></table>", "text/html");
        trTDs = parserDoc.getElementsByTagName("td");
        additionalResourceLink = "<div>" + [trTDs[0].innerHTML.slice(0, 3), 'title="' + trTDs[1].innerHTML + '"', trTDs[0].innerHTML.slice(3)].join('') + "</div>";
        additionalResourcesLinks += additionalResourceLink;
    }
    tdata.additionalResources = additionalResourcesLinks;

    return tdata;
}

function createData(featureSet) {

    // Pull the template for rendering each metric's html from the report.html file.
    var template = _.template($("script.template-metric").html());

    // Populate the categories array with the titles of the metric categories.
    var categories = _.uniq(_.pluck(metricConfig, 'category'));

    var lineCharts = [];
    var metricMetadatas = [];

    _.each(categories, function (dim) {

        // @todo: I think the following line doesn't do anything.
        var theTable = $(".table-" + dim.toLowerCase().replace(/\s+/g, "-") + " tbody");

        var categoryMetrics = _.filter(metricConfig, function (el) {
            return el.category.toLowerCase() === dim.toLowerCase();
        });

        _.each(categoryMetrics, function (metric) {
            metricMetadatas.push(metric);
            var metricId = 'm' + metric.metric;

            var metadataTable = {};
            var aboutHTML;
            var importance;
            var metricTitle;
            var additionalResourcesLinks;
            var additionalResourcesHTML;

            // Pull in metadata for this metric via AJAX.
            $.ajax({
                url: 'data/meta/' + metricId + '.html',
                type: 'GET',
                dataType: 'text',
                success: function (data) {
                    theTable.append(template(parseMetadataHTML(metricId, data)));
                },
                error: function (error, status, desc) {
                },
            });
        });

        // Parse models for each metric
        var graphingObject = [];
        var metricObject = [];
        var featureObject = [];
        var featureID;
        var metricYears = [];
        var metricValues;

        _.each(metricMetadatas, function (metricMetadata) {

            var metricName = "m" + metricMetadata.metric;
            var model = setModel(metricName);
            var metricField = metricName;
            var keys = getYear(metricName);
            var yearTDs = "";
            var types = [];
            model.metricID = metricMetadata;
            model.prefix = getPrefix(metricName);
            model.suffix = getSuffix(metricName);

            _.each(featureSet, function (feature) {
                var theYear;
                var yeariii;
                var iii;
                var years = [];
                var featureValue;
                var featureNValue;
                var featureValues = [];
                var selectedValues = [];
                var countyValues = [];
                var tdata = {};
                metricValues = [];
                featureID = feature;

                for (iii = 0; iii < keys.length; iii++) {
                    theYear = keys[iii];
                    model.years = keys;
                    featureNValue = metricValuesByIDYear(model.metric, feature, theYear, metricMetadata);
                    featureValue = dataPretty(featureNValue, metricName);
                    yeariii = keys[iii].replace('y_', '');
                    tdata.countyNVal = dataCrunch('y_' + yeariii);
                    tdata.selectedNVal = dataCrunch('y_' + yeariii, geographyList);
                    model.suffix = metricMetadata.suffix;
                    if (model.suffix == "%") {
                        featureValue = dataPretty(featureNValue * 100, metricName);
                        featureNValue = featureNValue * 100;
                    }
                    years.push(yeariii);
                    if (metricMetadata.decimals > 1) {
                        featureValues.push(dataRound(featureNValue, metricMetadata.decimals));
                        featureValue = dataRound(featureNValue, metricMetadata.decimals);
                        selectedValues.push(dataRound(tdata.selectedNVal, metricMetadata.decimals));
                        countyValues.push(dataRound(tdata.countyNVal, metricMetadata.decimals));
                    }
                    metricValues.push(featureValue);
                    metricYears = years;
                }
                featureObject.push(featureID, metricYears, metricValues);

                if (years.length > 1) {
                    lineChartObject = new Object();
                    lineChartObject.years = years;
                    lineChartObject.featurevalues = featureValues;
                    lineChartObject.selectedvalues = selectedValues;
                    lineChartObject.countyvalues = countyValues;
                    lineCharts.push(lineChartObject);
                }
                if (iii > 0) {
                    createLineChart(lineCharts);
                }
            });
        });
    });
}


// ****************************************
// Initialize the map
// Neighborhoods labled with leaflet.label
// ****************************************
function createMap(data) {
    // set up map
    L.Icon.Default.imagePath = './images';
    var smallMap = L.map("smallmap", {
        attributionControl: false,
        zoomControl: false,
        touchZoom: false
    }).setView(mapGeography.center, mapGeography.defaultZoom - 1);

    // Disable drag and zoom handlers.
    smallMap.dragging.disable();
    smallMap.touchZoom.disable();
    smallMap.doubleClickZoom.disable();
    smallMap.scrollWheelZoom.disable();
    var selectedFeatures = [],
        selectedIDs = [];

    // add data filtering by passed neighborhood id's
    geom = L.geoJson(topojson.feature(data, data.objects[neighborhoods]), {
        style: {
            "color": "#FFA400",
            "fillColor": "#FFA400",
            "weight": 2,
            "opacity": 1
        },
        filter: function (feature, layer) {
            return geographyList.indexOf(feature.id.toString()) !== -1;
        },
        onEachFeature: function (feature, layer) {
            selectedFeatures.push(feature);
            selectedIDs.push(feature.id);
        }
    }).addTo(smallMap);
    L.tileLayer(baseTilesURL).addTo(smallMap);

    // scaffold in category pages
    pageTemplates(geom, selectedFeatures, selectedIDs);
}

// ****************************************
// get pages in for data categories
// ****************************************
function pageTemplates(layer, geoms, IDs) {
    var template = _.template($("#template-category").html()),
        categories = _.uniq(_.pluck(metricConfig, 'category')),
        pages = $(".category-pages");

    _.each(categories, function (el) {
        cat = el.toLowerCase();

        // get vis if available
        if ($("#template-vis-" + cat).length > 0) {
            vis = _.template($("#template-vis-" + cat.replace(/\s+/g, "-")).html());
        } else {
            vis = "";
        }

        // drop in category page
        pages.append(template({"vis": vis, "category": cat}));
    });
}

function lineChartData(lineChartLegend) {
    var featureValues = lineChartLegend.featurevalues,
        npaMean = lineChartLegend.selectedvalues,
        countyMean = lineChartLegend.countyvalues,
        keys = _.without(_.keys(model.metric[0]), "id");

    var data = {
        labels: [],
        datasets: [
            {
                label: 'Feature',
                fillColor: "rgba(239,223,0,0.2)",
                strokeColor: "rgba(239,223,0,1)",
                pointColor: "rgba(239,223,0,1)",
                pointStrokeColor: "#fff",
                pointHighlightFill: "#fff",
                pointHighlightStroke: "rgba(239,223,0,1)",
                data: []
            },
            {
                label: 'Selected',
                fillColor: "rgba(81,164,75,0.2)",
                strokeColor: "rgba(81,164,75,1)",
                pointColor: "rgba(81,164,75,1)",
                pointStrokeColor: "#fff",
                pointHighlightFill: "#fff",
                pointHighlightStroke: "rgba(81,164,75,1)",
                data: []
            },
            {
                label: "County",
                fillColor: "rgba(220,220,220,0.5)",
                strokeColor: "rgba(220,220,220,1)",
                pointColor: "rgba(220,220,220,1)",
                pointStrokeColor: "#fff",
                pointHighlightFill: "#fff",
                pointHighlightStroke: "rgba(220,220,220,1)",
                data: []
            }
        ]
    };

    _.each(featureValues, function (el, i) {
        data.datasets[0].data.push(el);
    });
    _.each(npaMean, function (el, i) {
        if (npaMean !== null) {
            data.datasets[1].data.push(Math.round(npaMean[i] * 10) / 10);
        }
    });

    _.each(countyMean, function (el, i) {
        data.labels.push(lineChartLegend.years[i].replace("y_", ""));
        data.datasets[2].data.push(Math.round(el * 10) / 10);
    });

    // remove select mean if no values are there
    if (!npaMean || npaMean === null) {
        data.datasets.shift();
    }
    return data;
}

var thePrefix, theSuffix;

function createLineChart(lineCharts) {
    _.each(lineCharts, function (lineChartLegend, i) {
        thePrefix = lineChartLegend.prefix;
        theSuffix = lineChartLegend.suffix;
        if (window.myLine) {
            window.myLine.destroy();
        }
        lineChartData(lineChartLegend);

        var ctx = document.getElementById("lineChartLegend" + lineChartLegend.id).getContext("2d");
        window.myLine = new Chart(ctx).Line(lineChartData(lineChartLegend), {
            responsive: true,
            maintainAspectRatio: true,
            showTooltips: true,
            animation: true,
            animationSteps: 1,
            tooltipEvents: ["mousemove", "touchstart", "touchmove"],
            tooltipTemplate: "<%if (label){%><%=label%>: <%}%><%= value %>",
            multiTooltipTemplate: "<%= value %>",
            scaleLabel: '<%= thePrefix + value + theSuffix %>',
            legendTemplate: '<% for (var i=0; i<datasets.length; i++){%><span class="title"  style="background-color:<%=datasets[i].strokeColor%>; margin-right: 5px">&nbsp;&nbsp;&nbsp;</span><span class="title"  style="margin-right: 5px"><%if(datasets[i].label){%><%=datasets[i].label%><%}%></span><%}%>'
        });
        $("#chartLegend" + lineChartLegend.id + lineChartLegend.feature).html(myLine.generateLegend());
    });
}

// ****************************************
// Document ready kickoff
// ****************************************
$(document).ready(function () {

    // Fetch map data and make map
    $.get(activeTOPOJSON, function (data) {
        createMap(data);
    });

    // Grab the neighborhood list from the URL to set the filter
    if (getURLParameter("n") !== "null") {
        geographyList = getURLParameter("n").split(",");
    }

    // Store the geography list in the model variable.
    model.selected = geographyList;

    // populate the neighborhoods list on the first page
    // if too long to fit one one line it lists the number of neighborhoods instead
    var geographyDescription = geographyList.join(", ");
    if (geographyDescription.length > 85) {
        $(".neighborhoods").text(geographyDescription + " " + neighborhoodDescriptor + "s");
    } else {
        $(".neighborhoods").text(neighborhoodDescriptor + "s : " + geographyDescription);
    }

    // Fetch the metrics and make numbers and charts. activeMergeJSON is defined in config.js.
    $.get(activeMergeJSON, function (data) {

        // Set global data variable once data is loaded.
        theData = data;

        // Compute summary values from base data and pull metadata.
        createData(geographyList);

        // Create and render charts.
        createCharts();
    });

});
