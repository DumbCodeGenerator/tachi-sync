let timer = null;
let lastScrollTop = 0;
let total = 0;
let current = 0;
let page;
let chapter = null;
let marked;
let forceScroll;

$(document).ready(function () {
    M.AutoInit();
    const instance = M.Dropdown.getInstance($(".dropdown-trigger"));
    //instance.options.
    if (!chapters || chapters.length === 0) {
        return;
    }

    $("#selector").on('change', function () {
        current = this.value;
        chapter = chapters[current];
        parse(chapter.url);
    });
    chapter = chapters[current];
    parse(chapter.url);
});

function nextChapter() {
    chapter = chapters[++current];
    parse(chapter.url);
}

function prevChapter() {
    chapter = chapters[--current];
    parse(chapter.url);
}

function parse(url) {
    page = chapter.page;
    forceScroll = page > 1;
    if (current > 0)
        $("#prevChap").removeClass('hidden');
    else
        $("#prevChap").addClass('hidden');

    if (current >= chapters.length - 1)
        $("#nextChap").addClass('hidden');
    else
        $("#nextChap").removeClass('hidden');

    marked = false;
    $(window).off("scroll");
    $('#header').fadeIn();
    $(".wrap").remove();
    showLoading();
    fetch("/parse/" + encodeURIComponent(url)).then(response => response.json()).then(data => {
        //data = JSON.parse(data);
        let servers = null;
        let links;
        if (!Array.isArray(data)) {
            servers = data.servers;
            links = data.links;
        } else {
            links = data;
        }
        links.forEach(image => {
            const $img = $(`<img data-src="${image}" class="image lazyload">`);
            if (servers) {
                $img.attr('data-srv', JSON.stringify(servers));
                $img.on('error', function () {
                    const $this = $(this);
                    const servers = JSON.parse($this.attr('data-srv'));
                    const link = $this.attr('src');
                    const brokenServer = link.match(/^[a-z]{4,5}:\/\/.*?\//)[0];
                    const brokenServerID = servers.indexOf(brokenServer);
                    if (brokenServerID !== -1)
                        servers.splice(brokenServerID, 1);
                    if (brokenServer.length) {
                        $this.attr('data-srv', JSON.stringify(servers));
                        $this.attr('src', link.replace(brokenServer, servers[0]));
                    }
                })
            }
            $(`<div class="wrap"></div>`).append($img).appendTo("#viewer");
        });
        total = links.length;
        $("#number").text("1/" + total);
        //console.log("parse");
        $(window).on("scroll", function () {
            let st = $(this).scrollTop();
            //console.log(st + "/" + lastScrollTop);
            if (st > lastScrollTop) {
                // downscroll code
                $('#header').fadeOut();
            } else {
                // upscroll code
                $('#header').fadeIn();
            }
            lastScrollTop = st;

            if (timer !== null) {
                clearTimeout(timer);
            }
            timer = setTimeout(function () {
                if(forceScroll){
                    const newNumber = page + "/" + total;
                    $("#number").text(newNumber);
                    forceScroll = false;
                    return;
                }
                $(".wrap").each((i, val) => {
                    if (isElementInViewport(val)) {
                        const newNumber = (i + 1) + "/" + total;
                        $("#number").text(newNumber);
                        if(i+1 === total && !marked){
                            const data= {id: chapter.id};
                            $.ajax({
                                method: 'PATCH',
                                cache: false,
                                contentType: "application/json",
                                data: JSON.stringify(data),
                                url: '../sync',
                                success: function (data) {
                                    marked = true;
                                    console.log(`Глава с ID ${chapter.id} помечена, как прочитанная. Статус код: ${data}`);
                                }
                            })
                        }
                    }
                });
            }, 150);
        });
        removeLoading();
        lazyload();
        if (forceScroll) {
            $(".wrap").get(page - 1).scrollIntoView();
        }
    });
}

function isElementInViewport (el) {

    // Special bonus for those using jQuery
    if (typeof jQuery === "function" && el instanceof jQuery) {
        el = el[0];
    }

    const rect = el.getBoundingClientRect();

    let result;
    if(rect.top <= 0){
        result = rect.height + rect.top >= 0
    }else {
        result = rect.top <= $(window).height()
    }
    return result;
}

function showStub() {
    $("#stub").removeAttr("hidden");
}

function showLoading() {
    const loadingElem = $(".preloader-wrapper");

    if(!loadingElem.hasClass("active"))
        loadingElem.addClass("active");
}

function removeLoading() {
    $(".preloader-wrapper").removeClass("active");
}