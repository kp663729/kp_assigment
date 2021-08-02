const WebSocket = require('ws')
    const fs = require('fs');

const async = require('async');

const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

//we are getting btcusdt market depth
const binanceMarketDepthUrl = 'wss://stream.binance.com:9443/ws/btcusdt@depth'
const binanceConn = new WebSocket(binanceMarketDepthUrl)

var clientOrderSize;

async.series([
        function (callback) {
			console.log('Close up with "CTRL+C"')
            //read user order size to process
            readline.question('Sell order size to process: ', size => {
                clientOrderSize = parseFloat(size)
                console.log('Confirming ' + clientOrderSize + ' size');
                //readline.close();
                callback();
            });
        },
        function (callback) {
            //open marketDepth.json "db" file and init json array
            fs.writeFile('./marketDepth.json', '[', function (err) {
                if (err)
                    return console.log(err);
                console.log('File marketDepth.json opened')
                callback();
            });
        },
        function (callback) {

            //set keypressing event

            process.stdin.setRawMode(true);
            process.stdin.on("keypress", function (chunk, key) {
                if (key && key.name === "c" && key.ctrl) {

                    console.log("User pressed CTRL+C, shutting down the app")
                    async.series([
                            function (callback) {
                                //close binance connection
                                //binanceConn.close();
                                console.log("Closing Binance websocket connection")
                                callback();
                            },
                            function (callback) {
                                //close json array in  marketDepth.json "db" file
                                fs.appendFile('./marketDepth.json', ']', function (err) {
                                    if (err)
                                        return console.log(err);
                                    console.log("JSON data array closed")
                                    callback();
                                });
                            },
                            function (callback) {
                                //shut down the app
                                console.log("Application being shut down...")
                                process.exit(0);
                            }
                        ]);

                }
            });

            //processing Binance market depth for BTCUSDT
			
			console.log('Processing Binance market depth for BTCUSDT')
			
            binanceConn.on('message', function (data) {

                const marketDepthDataBatch = JSON.parse(data);

                //LAMBA - data batch - keep updating arketDepth.json "db" file with incoming market depth data
                
				//append market depth data into marketDepth.json "db" file
                fs.appendFile("./marketDepth.json", JSON.stringify(marketDepthDataBatch) + ",\n", function (err) {
                    if (err) {
                        return console.log(err);
                    }
                    //console.log("Binance data batched saved.");
                });


                //LAMDA - live advice average price, updated with each batch
				findAveragePrice(marketDepthDataBatch) 
            });
        }
    ]);


function findAveragePrice(marketDepthDataBatch) {
	
	//extract ask market depth from the lastest batch
	var marketDepthAsk = marketDepthDataBatch.a
	
	//sort ask price levels (for some reason the batch is not sorted by price levels)
	var marketDepthAskSorted =  marketDepthAsk.sort(function(a, b) {
		return b[0] - a[0];
	});
	//console.log(marketDepthAskSorted)	
	
	//simplyfied algo to find average ask price for the client sell order size
	//it does NOT weight available liquidity in each price level, which could be improved
	
	var accumulatedOrderSize = 0;
	var arrayIndex = 0;
	var clientOrderFilled = false;
	for (var i = 0; i < marketDepthAskSorted.length; i++) {
		accumulatedOrderSize = accumulatedOrderSize + parseFloat(marketDepthAskSorted[i][1]);
		if (accumulatedOrderSize >= clientOrderSize) {
			arrayIndex = i;
			clientOrderFilled = true;
		}
	}

	if (clientOrderFilled == false) {
		console.log("No liquidity to fullfill client order size")
	} else {
		var averagePrice = parseFloat(marketDepthAskSorted[0]) - (( parseFloat(marketDepthAskSorted[0]) - parseFloat(marketDepthAskSorted[arrayIndex]) ) / 2 )
		console.log("Average price client order size= " + averagePrice)
	}
}