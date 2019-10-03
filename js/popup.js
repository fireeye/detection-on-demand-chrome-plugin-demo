var API_KEY;
var result_json;
var API_URL = "https://feapi.marketplace.apps.fireeye.com";

function retrive_user_data() {
    chrome.storage.local.get("api_key", function (items) {
        if (items.api_key != undefined)
            API_KEY = items.api_key;
    });
}

function hash_show_function(from_page, from_clipboard) {
    var hashes = []
    if (from_page !== undefined && from_page.action == 1 && from_page.hash) {
        hashes = from_page.hash != undefined ? from_page.hash : [];
    }
    if (from_clipboard !== undefined && from_clipboard.action == 1 && from_clipboard.hash) {
        for (var i = 0; i < from_clipboard.hash.length && from_clipboard.hash[i]; i++) {
            var temp = from_clipboard.hash[i];
            if (hashes.indexOf(temp) == -1)
                hashes.push(temp);
        }
    }
    if (hashes.length > 0) {
        var text = "";
        for (var i = 0; i < hashes.length; i++) {
            if (hashes[i] !== undefined && hashes[i].length == 32) {
                text += "<a href='#' class='hash' id=" + hashes[i] + ">" + hashes[i] + "</a><br>";
            }
        }
        $("#hash_holder").html("<div id='hash_label'><h3>Hashes</h3></div>");
        $("#hash_holder").append("<div id='hashes'>" + text + "</div>");
    } else {
        $("#hash_holder").html("No IoCs found on this web page");
        $("#hash_holder").addClass("alert alert-warning");
    }
    $(".hash").click(hash_result_show);

    $('#hash_label').click(function() {
        $('#hashes').toggle("slide");
    });
}

function get_all_data() {
    chrome.tabs.query({
        active: true,
        currentWindow: true
    }, function (tabs) {
        notes = tabs[0].url;
        chrome.tabs.executeScript(tabs[0].id, {
            file: "js/content.js"
        }, function () {
            var promises = [];
            promises[0] = new Promise(function (resolve, reject) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    msg: "start"
                }, resolve);
            });
            promises[1] = new Promise(function (resolve, reject) {
                chrome.runtime.sendMessage({
                    msg: "start"
                }, resolve);
            });
            Promise.all(promises).then(function (values) {
                hash_show_function(values[0], values[1]);
            });
        });
    });
}

function local_file_submit() {
    files = ($("#input_file"))[0].files
    $("#result").html("");
    $("#result").removeClass();
    var force_analyze = $("#force").is(":checked");
    if (files.length > 0) {
        var form = new FormData();
        form.append("context", "{}");
        form.append("force_analyze", force_analyze ? "True" : "False");
        for (var i = 0; i < files.length; i++) {
            form.append("file", files[i], files[i].fileName);
        }
        $.ajax({
            url: API_URL + '/file-submit/',
            type: 'post',
            dataType: 'json',
            headers: {
                "feye-auth-key": API_KEY,
            },
            processData: false,
            contentType: false,
            data: form,
            xhr: function () {
                var jqXHR = new window.XMLHttpRequest();
                jqXHR.upload.addEventListener("progress", function (evt) {
                    if (evt.lengthComputable) {
                        var percentComplete = Math.round((evt.loaded * 100) / evt.total) + "%";
                        $("#upload_progress").attr("aria-valuenow", percentComplete).css('width', percentComplete);
                        $("#upload_progress").text(percentComplete);
                    }
                }, false);
                return jqXHR;
            },
            success: function (data) {
                if ('status' in data) {
                    if (data['status'] == "success" && 'submission_id' in data) {
                        var text = "<strong>Submission success!</strong> Here is submission uuid<br>";
                        text += "<div id='uuid_div'>" + data['submission_id'] + "</div>";
                        alert = create_alert(text, "alert alert-success");
                        btn_copy = get_copybtn("#uuid_div");
                        $(btn_copy).attr("style", "margin-top:-40px");
                        $("#result").append($(alert))
                        $(alert).append(btn_copy);
                        uuid_save(data['submission_id']);
                        $("#uuid_text").val(data['submission_id']);
                    } else {
                        alert = create_alert(data['reason'], "alert alert-danger");
                        $(alert).appendTo($("#result"));
                    }
                }
                $("#submit_file").attr("disabled", false);
                console.log(data);
                $("#progress_parent").remove();
            },
            fail: function (data) {
                console.log(data);
                $("#submit_file").attr("disabled", false);
                alert = create_alert(data['responseText'], "alert alert-danger");
                $(alert).appendTo($("#result"));
                $("#progress_parent").remove();
            },
            error: function (jqXHR, exception) {
                console.log(jqXHR);
                console.log(exception);
                $("#submit_file").attr("disabled", false);
                alert = create_alert(jqXHR['responseText'], "alert alert-danger");
                $(alert).appendTo($("#result"));
                $("#progress_parent").remove();
            }
        });
        var text = '<div class="progress" id="progress_parent"> ' + 
                    '<div id = "upload_progress" class="progress-bar" role="progressbar" style="width: 0%;" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">0%</div>' +
                    '</div>'
        $("#result").append(text);
        $("#submit_file").attr("disabled", true);
    }
    $("#input_file").val('');
    $("#input_file").next('label').text("Choose file");
}

function uuid_save(uuid) {
    if (uuid.length == 36) {
        chrome.storage.local.get({
            recent_uuids: []
        }, function (result) {
            var uuids = result.recent_uuids;
            uuids.unshift(uuid);
            uuids = uuids.slice(0, 10);
            chrome.storage.local.set({
                recent_uuids: uuids
            });
        });
    }
}

function get_closebtn(remove_div, show_div)
{
    var btn_close = document.createElement('span');
    $(btn_close).addClass("glyphicon glyphicon-remove clipboard_button");
    $(btn_close).click(function(){
        if (show_div){
            $(show_div).slideDown("slow");
        }
        $(remove_div).html("");
    });
    return btn_close;
}

function result_show(hash, result) {
    $("#parent_hash_result").html("");
    $("#hashes").slideUp("slow");
    var hash_div = document.createElement("div");
    $(hash_div).html("Result for : " + hash);
    $(hash_div).append(get_closebtn("#parent_hash_result", "#hashes"));
    if (typeof (result) === "string") {
        var hash_result_div = document.createElement("div");
        $(hash_result_div).html(result);
    } else {
        var tn = document.createElement('pre').innerHTML = syntaxHighlight(JSON.stringify(result, null, 2));
        var data_div = document.createElement("div");
        $(data_div).attr("id", "hash_json");
        $(data_div).append(tn);
        btn_copy = get_copybtn("#hash_json");
        var hash_result_div = document.createElement("div");
        $(hash_result_div).html(btn_copy);
        $(hash_result_div).append(data_div)
        $(hash_result_div).addClass("uuid_json");
    }
    $("#parent_hash_result").append(hash_div);
    $("#parent_hash_result").append(hash_result_div);
}

function async(func, param) {
    setTimeout(function() {
        func(param);
    }, 0);
}

function copy_function(){
    element = $(this).attr("copy_from");
    var $temp = $("<textarea>");
    $("body").append($temp);
    $temp.val($(element).text()).select();
    document.execCommand("copy");
    $temp.remove();
}

function get_copybtn(copy_from)
{
    var btn_copy = document.createElement('span');
    $(btn_copy).addClass("glyphicon glyphicon-duplicate clipboard_button");
    $(btn_copy).attr("copy_from", copy_from);
    $(btn_copy).click(copy_function);
    return btn_copy;
}

function cell_copy(copy_from)
{
    var btn_copy = document.createElement('span');
    $(btn_copy).addClass("glyphicon glyphicon-duplicate clipboard_button");
    $(btn_copy).attr("copy_from", copy_from);
    $(btn_copy).click({text:copy_from},function(event){
        var $temp = $("<textarea>");
        $("body").append($temp);
        $temp.val(event.data.text).select();
        document.execCommand("copy");
        $temp.remove();
    });
    return btn_copy;
}

function file_result_uuid(uuid, extended) {
    $("#recent_uuid_result").removeClass();
    $("#json_download_recent").html("");
    $("#recent_uuid_result").html("");
        $.ajax({
            url: API_URL + '/file-result',
            type: 'get',
            data: "submission_id=" + uuid +
                "&extended=" + extended,
            headers: {
                "feye-auth-key": API_KEY,
            },
            processData: false,
            contentType: false,
            success: function (data) {
                uuid = uuid
                console.log(typeof(data));
                result_json = data;
                $("#recent_uuid_result").html("");
                $("#recent_uuid_result").removeClass();
                if (typeof(data) == "string")
                {
                    data = JSON.parse(data);
                }
                var tn = document.createElement('pre').innerHTML = syntaxHighlight(JSON.stringify(data, null, 2));
                var data_div = document.createElement("div");
                $(data_div).attr("id", "json_data");
                $(data_div).append(tn);

                btn_copy = get_copybtn("#json_data");
                $("#recent_uuid_result").html(btn_copy);
                $("#recent_uuid_result").append((data_div));
                $("#recent_uuid_result").addClass("uuid_json");
                var dl_button = $('<button class="btn btn-success dl_button" type="button" id="uuid_json_download">Download</button>');
                $("#json_download_recent").html("");
                $("#json_download_recent").append(dl_button);
                var clear_button = $('<button class="btn btn-success dl_button" type="button" id="uuid_clear">Clear</button>');
                $("#json_download_recent").append(clear_button);
                $("#uuid_clear").click(function () {
                    $("#json_download_recent").html("");
                    $("#recent_uuid_result").html("");
                    $("#uuid_json_download").remove();
                    $("#recent_uuid_result").removeClass();
                });
                $("#uuid_json_download").click(function () {
                    js = JSON.stringify(result_json, null, 2);
                    var blob = new Blob([js], {
                        type: "application/json;charset=utf-8"
                    });
                    var url = URL.createObjectURL(blob);
                    chrome.downloads.download({
                        url: url,
                        filename: uuid + ".json"
                    });
                });
                if(!extended){
                    var load_extended = $('<button class="btn btn-success" type="button" id="get_exented">Get Extended</button>');
                    $("#json_download_recent").append(load_extended);
                    $("#get_exented").click(function () {
                        file_result_uuid(uuid, true);
                    });
                }
            },
            fail: function (data) {
                console.log(data);
                $("#recent_uuid_result").jsonPresenter({
                    json: data['responseText'],
                });
                $("#recent_uuid_result").addClass("alert alert-danger");
                var clear_button = $('<button class="btn btn-success" type="button" id="uuid_clear">Clear</button>');
                $("#json_download_recent").append(clear_button);
                $("#uuid_clear").click(function () {
                    $("#json_download_recent").html("");
                    $("#recent_uuid_result").html("");
                    $("#recent_uuid_result").removeClass();
                });
            },
            error: function (jqXHR, exception) {
                console.log(jqXHR);
                console.log(exception);
                $("#recent_uuid_result").jsonPresenter({
                    json: jqXHR['responseJSON'],
                });
                $("#recent_uuid_result").addClass("alert alert-danger");
                var clear_button = $('<button class="btn btn-success" type="button" id="uuid_clear">Clear</button>');
                $("#json_download_recent").append(clear_button);
                $("#uuid_clear").click(function () {
                    $("#json_download_recent").html("");
                    $("#recent_uuid_result").html("");
                    $("#recent_uuid_result").removeClass();
                });
            }
        });
    var loading = '<br><div class="spinner-border" role="status">' +
            '<span class="sr-only spinner_loading">Loading...</span>' +
            '</div>  Getting result...';
    $("#recent_uuid_result").html(loading);
}

function uuid_result_show(link) {
    uuid = link.target.firstChild.textContent;
    console.log(uuid);
    if (uuid.length == 36){
        file_result_uuid(uuid, false);
    }
}

function hash_result_show(link) {
    hash = link.target.firstChild.textContent;
    $.ajax({
        url: API_URL + '/hash-lookup?hash=' + hash,
        type: 'get',
        headers: {
            "feye-auth-key": API_KEY,
        },
        processData: false,
        contentType: false,
        success: function (data) {
            result_show(hash, data);
        },
        fail: function (data) {
            result_show(hash, data);
        },
        error: function (jqXHR, exception) {
            result_show(hash, jqXHR['responseJSON']);
        }
    });
    var loading = '<br><div class="spinner-border" role="status">' +
                        '<span class="sr-only spinner_loading">Loading...</span>' + 
                        '</div>  Loading...';
    $("#parent_hash_result").html(loading);
}

function syntaxHighlight(json) {
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        var cls = 'number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'key';
            } else {
                cls = 'string';
            }
        } else if (/true|false/.test(match)) {
            cls = 'boolean';
        } else if (/null/.test(match)) {
            cls = 'null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
}
///////////////////////////////////////////////
// Used on result tab. When user click on Get Result button
///////////////////////////////////////////////
function file_result_search(uuid, extended){
        $("#uuid_result").html("");
        $("#uuid_result").removeClass();
        $("#json_download").html("");
        $.ajax({
            url: API_URL + '/file-result',
            type: 'get',
            data: "submission_id=" + uuid +
                "&extended=" + extended,
            headers: {
                "feye-auth-key": API_KEY,
            },
            processData: false,
            contentType: false,
            success: function (data) {
                $("#uuid_result").html("");
                $("#uuid_result").removeClass();
                $("#json_download").html("");
                uuid = uuid
                result_json = data;
                console.log(typeof(data));
                if (typeof(data) == "string")
                {
                    data = JSON.parse(data);
                }
                var tn = document.createElement('pre').innerHTML = syntaxHighlight(JSON.stringify(data, null, 2));
                var data_div = document.createElement("div");
                $(data_div).attr("id", "json_data");
                $(data_div).append(tn);
                btn_copy = get_copybtn("#json_data");
                $("#uuid_result").html(btn_copy);
                $("#uuid_result").append(data_div);
                $("#uuid_result").addClass("uuid_json");
                var dl_button = $('<button class="btn btn-success dl_button" type="button" id="uuid_json_download">Download</button>');
                $("#json_download").append(dl_button);
                var clear_button = $('<button class="btn btn-success dl_button" type="button" id="uuid_clear">Clear</button>');
                $("#json_download").append(clear_button);
                $("#uuid_clear").click(function () {
                    $("#uuid_result").html("");
                    $("#uuid_result").removeClass();
                    $("#json_download").html("");
                    $("#uuid_text").val("");
                });
                $("#uuid_json_download").click(function () {
                    js = JSON.stringify(result_json, null, 2);
                    var blob = new Blob([js], {
                        type: "application/json;charset=utf-8"
                    });
                    var url = URL.createObjectURL(blob);
                    chrome.downloads.download({
                        url: url,
                        filename: uuid + ".json"
                    });
                });
                if(!extended){
                    var load_extended = $('<button class="btn btn-success" type="button" id="get_exented">Get Extended</button>');
                    $("#json_download").append(load_extended);
                    $("#get_exented").click(function () {
                        file_result_search(uuid, true);
                    });
                }
            },
            fail: function (data) {
                console.log(data);
                $("#uuid_result").jsonPresenter({
                    json: data['responseText'],
                });
                $("#uuid_result").addClass("alert alert-danger");
                var clear_button = $('<button class="btn btn-success" type="button" id="uuid_clear">Clear</button>');
                $("#json_download").append(clear_button);
                $("#uuid_clear").click(function () {
                    $("#uuid_result").html("");
                    $("#uuid_result").removeClass();
                    $("#json_download").html("");
                    $("#uuid_text").val("");
                });
            },
            error: function (jqXHR, exception) {
                console.log(jqXHR);
                console.log(exception);
                $("#uuid_result").jsonPresenter({
                    json: jqXHR['responseJSON'],
                });
                $("#uuid_result").addClass("alert alert-danger");
                var clear_button = $('<button class="btn btn-success" type="button" id="uuid_clear">Clear</button>');
                $("#json_download").append(clear_button);
                $("#uuid_clear").click(function () {
                    $("#uuid_result").html("");
                    $("#uuid_result").removeClass();
                    $("#json_download").html("");
                    $("#uuid_text").val("");
                });
                $("#uuid_result").addClass("alert alert-danger");
            }
        });
        var loading = '<br><div class="spinner-border" role="status"> ' +
                        '<span class="sr-only spinner_loading">Loading...</span>' +
                        '</div>  Getting result...';
        $("#uuid_result").html(loading);
}

function uuid_get_result() {
    $("#uuid_result").html("");
    $("#uuid_result").removeClass();
    $("#json_download").html("");
    result_json = "";

    uuid = $("#uuid_text").val().trim();
    if (uuid.length == 36) {
        file_result_search(uuid, false);
    }
}
function table_for_uuids(uuids) {
    var intresting_cols = ['submission_uuid', 'md5_hash', 'is_malicious', 'overall_status', 'file_name']
    var theads = ['UUID', 'MD5', 'Malicious', 'Status', 'File Name'];

    var table = $('<table>').addClass('table table-sm table-responsive-sm table-hover w-auto');
    var heading = "<thead class='thead-dark'><tr>"
    $(theads).each(function(i){
        heading += "<th scope='col' >" + theads[i] + "</th>"
    });
    heading += "</tr></thead>"
    table.append(heading);
    table.append("<tbody>");
    $(uuids).each(function(i) {
        var row = $('<tr>');
        $(intresting_cols).each(function(j){
            var cell = $('<td>');
            switch(intresting_cols[j]) {
                case 'submission_uuid':
                    cell.html("<a href='#' class='uuid'>" + uuids[i][intresting_cols[j]] + "</a>");
                    cell.addClass("sub_id");
                    break;
                case 'md5_hash':
                        cell.html(uuids[i][intresting_cols[j]]);
                        cell.addClass("sub_id");
                        break;
                case 'is_malicious':
                    if (uuids[i]['is_malicious']){
                        $(row).addClass("table-danger");
                        cell.text("Yes");
                    }
                    else{
                        cell.text("No");
                    }
                    break;
                default:
                    cell.text((uuids[i][intresting_cols[j]]));
                break;
            }
            row.append(cell);
        });
        table.append(row);
    });
    table.append("</tbody>");
    return table;
 }

 
function show_recent_page() {
    $("#recent_div").html("");
    $("#recent_uuid_result").html("");
    $("#recent_uuid_result").removeClass();
    $("#json_download_recent").html("");

    $.ajax({
        url: API_URL + "/get-submissions",
        data: "limit=10",
        type: "get",
        dataType: "json",
        headers: {
            "feye-auth-key": API_KEY,
        },
        processData: false,
        contentType: false,
        success: function (data) {
            console.log(data);
            var text = "<b>Recent submissions</b><br>";
            if ('response' in data && data['response'] instanceof Array) {
                if (data['response'].length == 0) {
                    $("#recent_div").html("");
                    alert = create_alert("No recent submissions", "alert alert-warning");
                    $(alert).appendTo($("#recent_div"));
                } else {
                    table = table_for_uuids(data['response']);
                    $("#recent_div").removeClass();
                    $("#recent_div").html("<b>Recent submissions</b><br>");
                    $("#recent_div").append(table);
                    $(".uuid").click(uuid_result_show);

                    $(".sub_id").mouseenter(function(event){
                        btn = cell_copy(event.target.innerText);
                        $(event.target).append(btn);
                    });
                    $(".sub_id").mouseleave(function(event) {
                        $(this).find("a").children("span").remove();
                        $(this).children("span").remove();
                    });

                }
            } else {
                if ('response' in data) {
                    alert = create_alert(data['response'], "alert alert-danger");
                    $(alert).appendTo("#recent_div");
                }
            }
        },
        fail: function (data) {
            console.log(data);
            $("#recent_uuid_result").jsonPresenter({
                json: data['responseText'],
            });
            $("#recent_uuid_result").addClass("alert alert-danger");
            var clear_button = $('<button class="btn btn-success" type="button" id="uuid_clear">Clear</button>');
            $("#json_download_recent").append(clear_button);
            $("#uuid_clear").click(function () {
                $("#json_download_recent").html("");
                $("#recent_uuid_result").html("");
                $("#recent_uuid_result").removeClass();
            });
            $("#recent_div").html("");
        },
        error: function (jqXHR, exception) {
            console.log(jqXHR);
            console.log(exception);
            $("#recent_uuid_result").jsonPresenter({
                json: jqXHR['responseJSON'],
            });
            $("#recent_uuid_result").addClass("alert alert-danger");
            var clear_button = $('<button class="btn btn-success" type="button" id="uuid_clear">Clear</button>');
            $("#json_download_recent").append(clear_button);
            $("#uuid_clear").click(function () {
                $("#json_download_recent").html("");
                $("#recent_uuid_result").html("");
                $("#recent_uuid_result").removeClass();
            });
            $("#recent_div").html("");
        }
    });
    var loading = '<br><div class="spinner-border" role="status">' +
    '<span class="sr-only spinner_loading">Loading recent submissions</span>' +
    '</div>  Loading recent submissions...';
    $("#recent_div").html(loading);
}

function create_alert(msg, type) {
    var alert_close = "<a href='#' class='close' data-dismiss='alert' aria-label='close'>&times;</a>";
    alert = document.createElement("div");
    $(alert).addClass(type);
    $(alert).addClass("alert-dismissible show");
    $(alert).html(msg);
    $(alert).append(alert_close);
    return alert;
}

function get_submission_for_key() {
    $("#recent_div").html("");
    $("#recent_div").removeClass();
    $("#json_download_recent").html("");
    $("#recent_uuid_result").html("");
    $("#recent_uuid_result").removeClass();
    var is_malicious = $("#malicious").is(":checked");

    var limit = $("#limit").val();
    if (limit.length > 0 && !$.isNumeric(limit)) {
        $("#recent_div").html("Limit must be number");
        $("#recent_div").addClass("alert alert-danger");
    } else {
        var days = 7;
        limit = limit.length == 0 ? "10" : limit;
        var time_value = ((new Date).getTime() - (7 * 86400 * 1000)).toString();
        var type = is_malicious ? "malicious" : "benign";
        var status = $("#status").val();
        data = "limit=" + limit +
        "&type=" + type + 
        "&started_at=" + time_value +
        "&days=" + days;
        if (status != 'any')
            data += "&status=" + status
        $.ajax({
            url: API_URL + "/get-submissions",
            type: "get",
            dataType: "json",
            data: data,
            headers: {
                "feye-auth-key": API_KEY,
            },
            processData: false,
            contentType: false,
            success: function (data) {
                if (typeof(data) == "string")
                {
                    data = JSON.parse(data);
                }
                var text = "<b>Results</b><br>";
                if ('response' in data && data['response'] instanceof Array) {
                    if (data['response'].length == 0) {
                        $("#recent_div").html("");
                        alert = create_alert("No result for search", "alert alert-warning");
                        $(alert).appendTo($("#recent_div"));
                    } else {
                        for (var i = 0; i < data['response'].length; i++) {
                            if ('submission_uuid' in data['response'][i]) {
                                uuid = data['response'][i]['submission_uuid'];
                                text += "<a href='#' class='uuid' id=" + uuid + ">" + uuid + "</a><br>";
                            }
                        }
                        table = table_for_uuids(data['response']);
                        $("#recent_div").removeClass();
                        $("#recent_div").html("<b>Results</b><br>");
                        $("#recent_div").append(table);
                        $(".uuid").click(uuid_result_show);

                        $(".sub_id").mouseenter(function(event){
                            btn = cell_copy(event.target.innerText);
                            $(event.target).append(btn);
                        });
                        $(".sub_id").mouseleave(function(event) {
                            $(this).find("a").children("span").remove();
                            $(this).children("span").remove();
                        });
                    }
                } else {
                    if ('response' in data) {
                        alert = create_alert(data['response'], "alert alert-danger");
                        $(alert).appendTo("#recent_div");
                    }
                }
            },
            fail: function (data) {
                console.log(data);
                $("#recent_uuid_result").jsonPresenter({
                    json: data['responseText'],
                });
                $("#recent_uuid_result").addClass("alert alert-danger");
                var clear_button = $('<button class="btn btn-success" type="button" id="uuid_clear">Clear</button>');
                $("#json_download_recent").append(clear_button);
                $("#uuid_clear").click(function () {
                    $("#json_download_recent").html("");
                    $("#recent_uuid_result").html("");
                    $("#recent_uuid_result").removeClass();
                });
                $("#recent_div").html("");
            },
            error: function (jqXHR, exception) {
                console.log(jqXHR);
                console.log(exception);
                $("#recent_uuid_result").jsonPresenter({
                    json: jqXHR['responseJSON'],
                });
                $("#recent_uuid_result").addClass("alert alert-danger");
                var clear_button = $('<button class="btn btn-success" type="button" id="uuid_clear">Clear</button>');
                $("#json_download_recent").append(clear_button);
                $("#uuid_clear").click(function () {
                    $("#json_download_recent").html("");
                    $("#recent_uuid_result").html("");
                    $("#recent_uuid_result").removeClass();
                });
                $("#recent_div").html("");
            }
        });
        var loading = '<br><div class="spinner-border" role="status">' +
                        '<span class="sr-only spinner_loading">Searching...</span>' + 
                        '</div>  Searching...';
        $("#recent_div").html(loading);
    }
}

function humanFileSize(bytes) {
    var thresh = 1024
    if (Math.abs(bytes) < thresh) {
        return bytes + ' B';
    }
    var units = ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    var u = -1;
    do {
        bytes /= thresh;
        ++u;
    } while (Math.abs(bytes) >= thresh && u < units.length - 1);
    return bytes.toFixed(1) + ' ' + units[u];
}

$(document).ready(function () {
    get_all_data();
    retrive_user_data();
    $(".custom-file-input").on("change", function () {
        var fileName = $(this).val().split("\\").pop();
        $(this).siblings(".custom-file-label").addClass("selected").html(fileName);
    });
    $("#submit_file").click(local_file_submit);
    $("#uuid_search").click(uuid_get_result);
    $("#get_submissions").click(get_submission_for_key);
    $("#recent_tab_id").on("click", show_recent_page);
    $("#input_file").on('change', function () {
        var text = $(this).next('label').text() + "\t" + humanFileSize(this.files[0].size);
        $(this).next('label').text(text);
    });
    $("#uuid_text").keyup(function(event){if (event.keyCode === 13) {$("#uuid_search").click();}});
});