// —[ form theme-color ]———————————————————————————————————————————————————————————————————————————————————————————————————

$(document).ready(function () {

    // ดึงค่าจาก CSS variable ใน :root
    let primaryColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--primary-color')
        .trim() || '#84D4FA';

    // เปลี่ยนค่า theme-color meta tag
    const $themeMeta = $('meta[name="theme-color"]');
    if ($themeMeta.length) {
        $themeMeta.attr('content', primaryColor);
    } else {
        // สร้าง meta tag ใหม่ถ้าไม่มี
        $('head').append(`<meta name="theme-color" content="${primaryColor}">`);
    }

    // กำหนด theme-color ใน CSS variable (ไม่ใช้ setProperty เพราะ value ว่าง)
    document.documentElement.style.setProperty('--primary-color', primaryColor);
});

// —[ tailwindcss Config ]———————————————————————————————————————————————————————————————————————————————————————————————————

tailwind.config = {
    theme: {
        extend: {
            colors: {
                primary: "#84D4FA",
                secondary: "#FF7070",
                accent: "#FE4040",
                "white-smoker": "#F5F5F5",
            },
        },
    },
}

// —[ preloader ]———————————————————————————————————————————————————————————————————————————————————————————————————

$(window).on('load', function () {
    $('#preloader').fadeOut(700);

    loadTeamGitHub();

    // Init AOS
    AOS.init({
        duration: 700,
        once: true
    });
});

// ฟังก์ชันปิดการใช้งานลิงก์
function disableLink(event) {
    event.preventDefault();
}

// outline()
function outline() {
    $("head").append(`
        <style>
        *{
        outline: solid 1px red
        }
        </style>
        `);
}

// —[ nave menu bar ]———————————————————————————————————————————————————————————————————————————————————————————————————

$(document).ready(function () {
    const menuStyle = `
    /*//? Animation สำหรับ mobile */
    .mobile-menu {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        transition: all 300ms ease;
        transform-origin: top;
    }

    /*//? เมนูเปิดบนมือถือ */
        .mobile-menu.open {
        gap: 6px;
        opacity: 1;
        transform: scaleY(1);
    }

    /*//? เมนูปิดบนมือถือ */
    .mobile-menu.closed {
        opacity: 0;
        transform: scaleY(0);
    }

    /*//? แสดงเมนูปกติบนหน้าจอ md ขึ้นไป */
    @media (min-width: 768px) {
        .mobile-menu {
            width: auto;
            position: static;
            display: flex;
            flex-direction: row;
            background: transparent;
            shadow: none;
            opacity: 1 !important;
            transform: scaleY(1) !important;
            padding: 0;
        }
    }
    `;
    $("head").append(`<style>${menuStyle}</style>`);

    // ตัวแปรหลัก
    const $menuBtn = $("header button[aria-label='open menu']");
    const $nav = $("header nav");

    // ตั้งค่าเมนูเริ่มต้น
    $nav
        .addClass(
            "mobile-menu closed bg-white md:bg-transparent absolute md:static top-16 left-0 w-full md:w-auto shadow md:shadow-none p-4 md:p-0"
        )
        .removeClass("hidden");

    // toggle เมนู
    $menuBtn.on("click", function () {
        const isOpen = $nav.hasClass("open");

        if (isOpen) {
            $nav.removeClass("open").addClass("closed");
        } else {
            $nav.removeClass("closed").addClass("open");
        }

        $(this).toggleClass("active");

        // เปลี่ยนไอคอน
        $(this)
            .find("svg")
            .html(
                !isOpen
                    ? `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>` : `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>`
            );
    });

    // ปิดเมนูเมื่อคลิก link (เฉพาะมือถือ)
    $nav.on("click", "a", function () {
        if (window.innerWidth < 768) {
            $nav.removeClass("open").addClass("closed");
            $menuBtn.removeClass("active").find("svg").html(`
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M4 6h16M4 12h16M4 18h16"></path>
        `);
        }
    });
});

// —[ quick-links config ]—————————————————————

const QUICK_LINKS = [
    { name: "Overview", path: "/" },
    { name: "Class Track Room", path: "/class-track-room/" },
    { name: "Student Entry Scanner", path: "/student-entry-scanner/" },
    { name: "สหกรณ์โรงเรียน", path: "/shop/", role: "shop" },
    { name: "เข้าสู่ระบบนักเรียน", path: "/student.html", role: "student" },
    { name: "ESP32 RFID Document", path: "/esp32-rfid-guide.html" },
    { name: "ลงทะเบียนบัตรนักเรียน", path: "/register.html", role: "" },
    // { name: "แดชบอร์ด คิดต่อฟรอม", path: "/dashboard/", role: "dashboard" },
    // { name: "แดชบอร์ด ติดตามนักเรียน", path: "/dashboard.html", role: "dashboard" },
    {
        name: "ติดต่อผู้ดูแลระบบ",
        url: "https://line.me/ti/p/Centered101",
        external: true
    }
];

$(function () {

    const BASE_PATH = window.location.origin;
    const $nav = $("#main-nav");

    function isCurrentPage(link) {
        if (!link.path) return false;
        const current = location.pathname.replace(/\/$/, "");
        const target = link.path.replace(/\/$/, "");
        return current === target;
    }

    const visibleLinks = QUICK_LINKS.filter(link => !isCurrentPage(link));

    const student = visibleLinks.find(l => l.role === "student");
    const others = visibleLinks.filter(l => l.role !== "student");

    const primaryLinks = [
        others[0],
        others[1],
        student
    ].filter(Boolean);

    const extraLinks = others.slice(2);

    function buildLink(link) {

        const href = link.url ?? (BASE_PATH + link.path);

        const currentPage = location.pathname.replace(/\/$/, "");

        const isStudentPage = currentPage === "/student.html";
        const isShopLink = link.role === "shop";
        const isStudentLink = link.role === "student";

        const highlightShop = isStudentPage && isShopLink;

        const btnClass =
            highlightShop
                ? "btn-outline text-right px-6 overflow-hidden"
                : isStudentLink
                    ? "btn-outline text-right px-6 overflow-hidden"
                    : "btn-ghost text-right text-black overflow-hidden";

        return `
        <a href="${href}"
           class="${btnClass}"
           ${link.external ? 'target="_blank" rel="noopener noreferrer"' : ''}>
           ${link.name}
        </a>
    `;
    }

    // render main links
    primaryLinks.forEach(link => {
        $nav.append(buildLink(link));
    });

    // dropdown
    if (extraLinks.length) {
        const dropdown = $(`
        <div class="relative group">
            <button class="btn-ghost flex items-center gap-1 text-right text-black overflow-hidden">
                <span>เพิ่มเติม</span>
                <i class="fa-solid fa-angle-down"></i>
            </button>

            <div class="absolute right-0 min-w-[250px] hidden bg-white border rounded-xl shadow-2xl z-40 group-hover:block">
                <ul class="space-y-1 p-1"></ul>
            </div>
        </div>
        `);

        const $list = dropdown.find("ul");

        extraLinks.forEach(link => {
            const href = link.url ?? (BASE_PATH + link.path);
            $list.append(`
                <li>
                    <a href="${href}" class="btn-ghost flex items-center gap-2 text-black overflow-hidden"
                    ${link.external ? 'target="_blank" rel="noopener noreferrer"' : ''}>
                        <span>${link.name}</span>
                    ${link.external ? '<i class="fa-solid fa-up-right-from-square text-xs"></i>' : ''}
                    </a>
                </li>
            `);
        });

        $nav.append(dropdown);
    }
});

$(function () {
    const footerHTML = `
        <p>
            <span>© 2024 - 2026</span>
            <a href="https://project-test-submission.netlify.app/centered101/" 
               target="_blank"
               rel="noopener noreferrer"
               class="btn-text">
               Centered101
            </a>
            <span>• ASIA-BOT — สงวนลิขสิทธิ์ทุกประการ</span>
        </p>
    `;

    // if ($('footer').length === 0) {
    //     $('body').append('<footer class="text-center text-xs sm:text-sm text-gray-500 py-12"></footer>');
    // }

    $('footer').addClass('text-center text-xs sm:text-sm text-gray-500 py-12').html(footerHTML);
});

// —[ quick-links ]———————————————————————————————————————————————————————————————————————————————————————————————————

$(function () {

    // base path ของเว็บ (ปรับได้ถ้า host ใน subfolder)
    const BASE_PATH = window.location.origin;

    const $list = $("#quick-links");

    QUICK_LINKS.forEach(link => {
        const href = link.url ?? (BASE_PATH + link.path);

        const $item = $(`
            <li>
            <a href="${href}"
            class="btn-text flex items-center gap-2 text-gray-600 overflow-hidden"
            ${link.external ? 'target="_blank" rel="noopener noreferrer"' : ''}>
            <span>${link.name}</span>
            ${link.external ? '<i class="fa-solid fa-up-right-from-square text-xs"></i>' : ''}
            </a>
            </li>
            `);

        $list.append($item);
    });

});

// —[ ripple effect ]———————————————————————————————————————————————————————————————————————————————————————————————————

/**
* Ripple Effect Utility
* ใช้ได้กับทุก element ที่มี class "ripple-effect"
*/
(function ($) {
    function createRippleEffect($element,
        event) {
        const rect = $element[0].getBoundingClientRect();
        const size = Math.max(rect.width,
            rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;

        const $ripple = $('<span class="ripple"></span>');
        $ripple.css({
            position: 'absolute',
            width: size + 'px',
            height: size + 'px',
            left: x + 'px',
            top: y + 'px',
            background: 'var(--primary-color)',
            borderRadius: '50%',
            transform: 'scale(0)',
            animation: 'ripple-animation 0.6s ease-out',
            pointerEvents: 'none',
            zIndex: 50
        });

        $element.css('position',
            'relative').append($ripple);

        setTimeout(() => {
            $ripple.remove();
        },
            700);
    }

    // inject keyframes แค่ครั้งเดียว
    if ($('#ripple-keyframes').length === 0) {
        $('head').append(`
            <style id="ripple-keyframes">
            @keyframes ripple-animation {
            to {
            transform: scale(2);
            opacity: 0;
            }
            }
            .ripple-effect {
            overflow: hidden; /* ป้องกัน ripple เกินขอบ */
            position: relative;
            }
            </style>
            `);
    }

    // Auto bind event ให้ทุก element ที่มี class ripple-effect
    $(document).on("click", ".ripple-effect", function (e) {
        createRippleEffect($(this), e);
    });
    // ใช้กับทุก element ที่ class มีคำว่า "btn"
    $(document).on("click", "[class*='btn']", function (e) {
        createRippleEffect($(this), e);
    });

})(jQuery);

// —[ team ]———————————————————————————————————————————————————————————————————————————————————————————————————

function loadTeamGitHub() {

    $(document).ready(() => {
        const usernames = [
            "Centered101",
            "Centered101-dev",
        ];
        const $team = $("#team");
        const $loading = $("#loadingTeam");
        const noImages = "https://project-test-submission.netlify.app/images/img/noitems.svg";
        let loadedCount = 0;
        $team.empty().append($loading);

        usernames.forEach(username => {
            $.getJSON(`https://api.github.com/users/${username}`)
                .done(user => {
                    const card = $(`
                    <a href="${user.html_url}" target="_blank" class="ripple-effect flex items-start justify-between gap-2 bg-gray-50 border rounded-lg shadow-inner p-2">
                    <img src="${user.avatar_url}"
                    alt="${user.login}"
                    class="size-14 sm:size-16 border border-[color:var(--primary-color)] rounded"
                    loading="lazy"
                    draggable="false"
                    style="background-image: url('${noImages}'); background-size: cover; background-position: center;"
                    onerror="this.onerror=null;this.src='${noImages}';">
                    <span class="flex-1">
                    <p class="text-sm sm:text-base font-bold">${user.name || user.login}</p>
                    <p class="text-xs sm:text-sm text-gray-600 line-clamp-2">${user.bio || ""}</p>
                    </span>
                    <i class="fa-solid fa-up-right-from-square text-xs"></i>
                    </a>
                    `);

                    $team.append(card);
                })
                .fail(() => {
                    $team.html(`
                    <div class="col-span-full text-center text-sm sm:text-base text-gray-600 space-y-2 py-6">
                    <i class="fa-brands fa-dev text-5xl mb-4"></i>
                    <p>ทีมผู้พัฒนา แม่งงอแงหนีไปพักอีกละ</p>
                    <p>รอมันชาร์จพลังแป๊บนะ เดี๋ยวลากกลับมาทำงานต่อให้</p>
                    </div>
                    `);
                })
                .always(() => {
                    loadedCount++;
                    if (loadedCount === usernames.length) {
                        $loading.remove();
                    }
                });
        });
    });
};

// —[ Notification Popup System ]———————————————————————————————————————————————————————————————————

// กำหนด global variables สำหรับ popup notification
window.NotificationPopup = {
    queue: [],
    container: null
};

// รอให้ jQuery โหลดเสร็จก่อน
function initializeNotificationPopup() {
    // ถ้า jQuery ยังไม่พร้อม ให้รอ
    if (typeof $ === 'undefined') {
        setTimeout(initializeNotificationPopup, 100);
        return;
    }

    // ฟังก์ชันหลักแสดง notification popup
    window.showNotification = function (message, type = '', link = null) {
        if (!message) {
            console.warn('showNotification: message is required');
            return;
        }

        // ถ้า jQuery ไม่พร้อม ให้แสดงแค่ใน console
        if (typeof $ === 'undefined') {
            console.log(`[${type.toUpperCase()}] ${message}${link ? ` - ${link}` : ''}`);
            return;
        }

        // สร้าง container ถ้ายังไม่มี
        if (!window.NotificationPopup.container) {
            window.NotificationPopup.container = $('<div style="position: fixed; bottom: 16px; right: 16px; z-index: 9999; display: flex; flex-direction: column; gap: 8px;"></div>');
            $('body').append(window.NotificationPopup.container);
        }

        const notification = $(`
            <div class="notification-item bg-[color:var(--white-smoker)] border rounded-xl shadow-xl px-3 py-2 transition-all duration-300 transform translate-x-full select-none ${!link ? 'cursor-pointer' : ''}">
            <div class="flex items-center gap-1">
            <div class="flex-shrink-0">
            ${type === 'custom' && iconUrl
                ? `<img src="${iconUrl}" class="size-16 object-contain" />` : type === 'success'
                    ? '<i class="fa-solid fa-circle-check text-green-500"></i>' : type === 'error'
                        ? '<i class="fa-solid fa-circle-exclamation text-red-500"></i>' : type === 'info'
                            ? '<i class="fa-solid fa-circle-info text-yellow-500"></i>' : '<i class="fa-solid fa-circle-info text-blue-500"></i>'
            }
            </div>
            <div class="flex-1">
            ${link ?
                `<a href="${link}" target="_blank" class="btn-text text-xs text-[color:var(--primary-color)] font-normal line-clamp-1">${message}</a>` :
                `<p class="text-xs font-normal break-words line-clamp-1">${message}</p>`
            }
            </div>
            </div>
            </div>
            `);

        window.NotificationPopup.container.append(notification);

        // Animation เข้า
        setTimeout(() => {
            notification.css('transform', 'translateX(0)');
        }, 10);

        // Timer management
        let timeoutId;
        let isHovered = false;
        let isFocused = false;

        function startTimer() {
            if (!isHovered && !isFocused) {
                timeoutId = setTimeout(closeNotification, 5000);
            }
        }

        function stopTimer() {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
        }

        function closeNotification() {
            notification.css({
                'transform': 'translateX(100%)',
                'opacity': '0'
            });
            setTimeout(() => {
                notification.remove();
                const index = window.NotificationPopup.queue.indexOf(notification);
                if (index > -1) {
                    window.NotificationPopup.queue.splice(index, 1);
                }
                if (window.NotificationPopup.queue.length === 0) {
                    window.NotificationPopup.container.remove();
                    window.NotificationPopup.container = null;
                }
            },
                300);
        }

        // Event listeners
        notification.on('mouseenter',
            function () {
                isHovered = true;
                stopTimer();
            });

        notification.on('mouseleave',
            function () {
                isHovered = false;
                startTimer();
            });

        if (!link) {
            notification.on('click', closeNotification);
        }

        window.NotificationPopup.queue.push(notification);
        startTimer();

        // จำกัดจำนวน notification ไม่เกิน 3 ตัว
        if (window.NotificationPopup.queue.length > 3) {
            const oldestNotification = window.NotificationPopup.queue[0];
            oldestNotification.css({
                'transform': 'translateX(100%)',
                'opacity': '0'
            });
            setTimeout(() => {
                oldestNotification.remove();
                window.NotificationPopup.queue.shift();
            }, 300);
        }
    };

    // ฟังก์ชันปิด notification ทั้งหมด
    window.clearAllNotifications = function () {
        if (typeof $ === 'undefined') return;

        window.NotificationPopup.queue.forEach(notification => {
            notification.css({
                'transform': 'translateX(100%)',
                'opacity': '0'
            });
            setTimeout(() => {
                notification.remove();
            }, 300);
        });
        window.NotificationPopup.queue = [];
        setTimeout(() => {
            if (window.NotificationPopup.container) {
                window.NotificationPopup.container.remove();
                window.NotificationPopup.container = null;
            }
        },
            300);
    };

    // Online/Offline detection
    $(window).on("offline",
        function () {
            window.showNotification("อ้าว เฮ้ย เน็ตหลุดละเว้ย 😐", "error");
        });

    $(window).on("online",
        function () {
            window.showNotification("โอ้ยย กลับมาแล้วเหรอเน็ตตัวดี 😍", "success");
        });
}

// รอให้ jQuery โหลดเสร็จแล้วจึงเริ่มต้นระบบ
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeNotificationPopup);
} else {
    initializeNotificationPopup();
}

// Test functions
window.testNotification = {
    general: () => window.showNotification('ทั่วไป'),
    success: () => window.showNotification('บันทึกข้อมูลสำเร็จ!', 'success'),
    error: () => window.showNotification('เกิดข้อผิดพลาดในการประมวลผล', 'error'),
    info: () => window.showNotification('ระบบกำลังอัปเดต กรุณารอสักครู่', 'info'),
    withLink: () => window.showNotification('ดูรายละเอียดเพิ่มเติม', 'info', 'https://example.com')
};