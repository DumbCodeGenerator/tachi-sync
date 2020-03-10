$(document).ready(function () {
    try {
        M.AutoInit();
        $('img').each(function () {
            loadAsync($(this));
        })
    } catch (e) {
    }
});

async function loadAsync(img) {
    const src = img.attr('data-src');
    try {
        const response = await fetch('/cache/' + encodeURIComponent(src));
        const data = await response.text();
        img.attr('src', data);
        img.removeAttr('data-src');
    } catch (e) {

    }
}

function openInNewTab(url) {
    const win = window.open(url, '_blank');
    win.focus();
}

function showStub() {
    $("#main").attr("hidden", "");
    $("#stub").removeAttr("hidden");
}

function showMain() {
    $("#stub").attr("hidden", "");
    $("#main").removeAttr("hidden");
}

function showLoading() {
    const loadingElem = $(".preloader-wrapper");

    if(!loadingElem.hasClass("active"))
        loadingElem.addClass("active");
}

function removeLoading() {
    $(".preloader-wrapper").removeClass("active");
}