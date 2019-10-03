document.getElementById('save_email').addEventListener('click', save_options);
restore_options();
function restore_options()
{
    console.log("Restoring old values");
    /* chrome.storage.local.get("user_email",function(items) {
        if (items.user_email != undefined)
            document.getElementById("email_text").value = items.user_email;
    }); */
    chrome.storage.local.get("api_key",function(items) {
        if (items.api_key != undefined)
            document.getElementById("api_key").value = items.api_key;
    });
}

function save_options()
{
    var api_key = document.getElementById("api_key").value.trim();

    var promises = [];
    promises[0] = new Promise(function (resolve, reject){
        chrome.storage.local.set({"api_key" : api_key}, resolve);

    });

    Promise.all(promises).then(function(values){
        console.log("Values set")
        $("#msg").html("API key saved successfully");
        $("#msg").addClass("alert alert-success");
    });
}