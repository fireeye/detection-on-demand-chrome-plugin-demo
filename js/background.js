////////////////////////////////////////////////////////
// background script
////////////////////////////////////////////////////////
function start_getting_hash() {
    bg = chrome.extension.getBackgroundPage();
    var helperdiv = null;
    if (helperdiv == null) {
            helperdiv = bg.document.createElement("div");
                document.body.appendChild(helperdiv);
                helperdiv.contentEditable = true;
        }
    helperdiv.innerHTML=""; // clear the buffer
    var range = document.createRange();
    range.selectNode(helperdiv);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    helperdiv.focus();
    bg.document.execCommand("Paste");
    return get_hashes(helperdiv.innerHTML);
}
function get_hashes(wholepage) {
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
    } while(result);
    if (hashes.length >= 1) {
        var msg = {
            action: 1,
            hash: hashes,
        }
        return msg;
    }
}
chrome.runtime.onMessage.addListener(receiver);
function receiver(request, sender, sendResponse) {
	if (request.msg === 'start') {
        var msg = start_getting_hash();
        if (msg) {
            sendResponse(msg);
        } else
            sendResponse("NA");
	}
}
