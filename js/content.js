/*Copyright (C) 2019 FireEye, Inc. All Rights Reserved.*/
if (window.hasRun == undefined) {
    function get_hashes() {
        wholepage = document.body.innerText;
        var links = document.links;
        var sha1_ex = /\b[a-fA-F0-9]{32}\b/gi;
        var hash_regex = new RegExp(sha1_ex);
    
        var result;
        var hashes = [];
        do {
            result = hash_regex.exec(wholepage);
            if (result && hashes.indexOf(result[0]) == -1) {
                var temp = result[0].toLowerCase();
                if (hashes.indexOf(temp) == -1) {
                    hashes.push(temp);
                }
            }
        } while (result);
        if (hashes.length >= 1) {
            var msg = {
                action: 1,
                hash: hashes,
            }
            return msg;
        }
    }
    function gotMsg(request, sender, sendResponse) {
        if (request.msg === "start") {
            var msg = get_hashes();
            if (msg) {
                console.log(msg);
                sendResponse(msg);
            } else
                sendResponse("NA");
        }
    }
    chrome.runtime.onMessage.addListener(gotMsg);
    window.hasRun = true;
}