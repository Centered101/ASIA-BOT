// ===== Constants =====
const PRIVILEGED_USERS = ["พงศ์พล พรมผา", "Centered101-dev"];
const SCORE_TEXT = {
    5: "พอใจมากที่สุด",
    4: "พอใจ",
    3: "ปานกลาง",
    2: "ไม่พอใจ",
    1: "ไม่พอใจมากที่สุด"
};

const MESSAGES = {
    welcome: [
        "ยินดีต้อนรับ เข้ามาแล้วก็อย่าลืมเลื่อนดูให้ครบก่อนนะ 🙂",
        "ยินดีต้อนรับ อย่าเพิ่งรีบ กรอกชิล ๆ ได้เลย 😄",
        "เข้ามาแล้ว พร้อมให้คะแนนกันหรือยัง 😏",
        "แบบประเมินนี้ไม่กัด กรอกสบาย ๆ ได้เลย",
        "ขอบคุณที่แวะมา ช่วยให้คะแนนหน่อยนะ 😉"
    ],
    success: [
        "จดหมายของคุณถูกส่งถึงปลายทางเรียบร้อย ไม่มีตีกลับ!",
        "ส่งสำเร็จ ขอบคุณที่ช่วยให้คะแนนนะ 😄",
        "จบภารกิจแล้ว ข้อมูลถึงปลายทางเรียบร้อย",
        "สำเร็จ! แบบประเมินของคุณมีคุณค่ามากเลย 🙌",
        "ข้อมูลถึงแล้ว ขอบคุณที่สละเวลา 😉"
    ],
    error: [
        "ข้อมูลยังไม่ครบ ระบบขอร้องเบา ๆ ให้กรอกให้ครบก่อนนะ",
        "เหมือนจะยังกรอกไม่ครบ ลองเช็กอีกนิดก่อนนะ 🙂",
        "ยังมีช่องว่างอยู่ ระบบขอให้เติมให้ครบก่อนน้า 😅",
        "เดี๋ยวก่อน ข้อมูลยังไม่ครบจริง ๆ นะ",
        "กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วนก่อนดำเนินการต่อ",
        "อีกนิดเดียวเอง เติมให้ครบก่อนค่อยไปต่อ 😉"
    ]
};

const FIELD_LABELS = {
    gender: "เพศ",
    evaluator: "สถานะผู้ประเมิน",
    role: "สถานะผู้ประเมิน",
    name: "ชื่อ - นามสกุล",
    emoji: "ความประทับใจ Emoji",
    creative: "ความคิดสร้างสรรค์",
    content: "เนื้อหา",
    presentation: "การนำเสนอ",
    usability: "การใช้งาน",
    overall: "ภาพรวมของผลงาน",
    comments: "ความคิดเห็นเพิ่มเติม",
    feedback: "ข้อเสนอแนะ",
    suggestion: "ข้อเสนอแนะ"
};

// ===== State =====
let state = {
    isSubmitting: false,
    currentSection: 1,
    submittedData: {}
};

// ===== Utilities =====
const utils = {
    sanitize: (value) => {
        // รองรับ: ภาษาไทย (รวมสระ วรรณยุกต์), อังกฤษ, ตัวเลข, อักขระพิเศษ, emoji
        return value.replace(/[^\p{L}\p{M}\p{N}\p{Emoji}\p{Emoji_Component}@._\-:/?&=#\n\r ]/gu, "");
    },

    random: (arr) => arr[Math.floor(Math.random() * arr.length)],

    isPrivileged: () => PRIVILEGED_USERS.includes($("#name").val().trim()),

    scrollToTop: () => $('html, body').animate({
        scrollTop: 0
    }, 300),

    getLabel: (key) => {
        const cleanKey = key.replace(/_project-\d+$/, '');
        return FIELD_LABELS[cleanKey] || cleanKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    },

    formatValue: (value) => {
        if (/^[1-5]$/.test(value)) return SCORE_TEXT[value] || value;
        return utils.getLabel(value) || value || '-';
    }
};

// ===== Privileged Mode =====
const privileged = {
    grant() {
        document.documentElement.style.setProperty('--primary-color', '#84D4FA');

        $('[required]').each(function () {
            $(this).removeAttr('required').attr('data-was-required', 'true');
        });

        $('[maxlength]').each(function () {
            $(this).attr('data-was-maxlength', $(this).attr('maxlength')).removeAttr('maxlength');
        });

        if (!$('.privileged-indicator').length) {
            $('#project-name').html(`
                <button class="privileged-indicator ripple-effect text-sm sm:text-base bg-gray-50 px-2 py-1 border rounded-md text-sm">
                โหมดผู้ใช้พิเศษ
                </button>
                `);

            $('.privileged-indicator').on('click', () => {
                showNotification("Dashboard Admin", "", "/dashboard/");
            });
        }

        showNotification("เข้าสู่โหมดผู้ใช้พิเศษ");
    },

    revoke() {
        document.documentElement.style.removeProperty('--primary-color');

        $('[data-was-required]').each(function () {
            $(this).attr('required', true).removeAttr('data-was-required');
        });

        $('[data-was-maxlength]').each(function () {
            $(this).attr('maxlength', $(this).attr('data-was-maxlength')).removeAttr('data-was-maxlength');
        });

        $('.privileged-indicator').remove();
    },

    isActive: () => $('.privileged-indicator').length > 0
};

// ===== Validation =====
const validation = {
    checkSection(index = state.currentSection) {
        const $section = $(`#section${index}`);
        const $required = $section.find('[required]');
        let isValid = true;
        let $firstInvalid = null;

        $section.find('.input-error').removeClass('input-error');

        $required.each(function () {
            const $input = $(this);
            const isChoice = $input.is(':radio, :checkbox');
            const hasValue = isChoice
                ? $section.find(`input[name="${$input.attr('name')}"]:checked`).length > 0 : $.trim($input.val()) !== '';

            if (!hasValue) {
                isValid = false;
                if (!$firstInvalid) $firstInvalid = $input;

                const $target = isChoice ? $input.closest('.space-y-4') : $input;
                $target.addClass('input-error');
                setTimeout(() => $target.removeClass('input-error'), 300);
            }
        });

        if (!isValid) {
            showNotification(utils.random(MESSAGES.error), "info");
            setTimeout(() => {
                if ($firstInvalid) {
                    $firstInvalid.focus();
                    $firstInvalid[0].scrollIntoView({
                        behavior: 'smooth', block: 'center'
                    });
                }
            },
                100);
        }

        return isValid;
    }
};

// ===== Character Counter =====
const counter = {
    init() {
        $('#name').on('input',
            function () {
                const length = $(this).val().length;
                $('#countName').text(length)
                    .toggleClass('text-[color:var(--accent-color)]', !privileged.isActive() && length > 50);
            });

        $('#comments').on('input',
            function () {
                const length = $(this).val().length;
                const $counter = $('#countComments');

                if (privileged.isActive()) {
                    $counter.text(`(ไม่จำกัดตัวอักษร) ${length}`)
                        .removeClass('text-[color:var(--accent-color)]');
                } else {
                    $counter.text(length)
                        .toggleClass('text-[color:var(--accent-color)]', length > 440);
                }
            });
    }
};

// ===== Navigation =====
const navigation = {
    next() {
        if (!validation.checkSection()) return;

        $('#section1').fadeOut(300);
        $('#section2').fadeIn(300);
        $('#currentStep').text('2');
        state.currentSection = 2;
        utils.scrollToTop();
    },

    previous() {
        $('#section2').fadeOut(300);
        $('#section1').fadeIn(300);
        $('#currentStep').text('1');
        state.currentSection = 1;
        utils.scrollToTop();
    }
};

// ===== Form Submission =====
const form = {
    submit(formData) {
        $.ajax({
            url: "https://script.google.com/macros/s/AKfycby9PPYFDJI52Sm468HlteAE_EDfxnhnorICYAU48Yhnuk4jZBQjCkqXQioX3RaMj3Y4/exec",
            type: "POST",
            data: formData,
            processData: false,
            contentType: false,
            success: (response) => {
                const data = $("#surveyForm").serializeArray().reduce((acc, field) => {
                    acc[field.name] = field.value;
                    return acc;
                }, {});

                state.submittedData = data;
                console.log("Form Data:", data, "Success!", response);

                showNotification(utils.random(MESSAGES.success), "success");
                $("#loader").removeClass("enter").addClass("end");
                $('#formOverlay').fadeOut(700);
                modal.success(data);
                form.reset();
            },
            error: (xhr, status, error) => {
                console.error("Error!", error);
                showNotification("ที่อยู่ไม่ชัด ระบบงง ส่งไม่ถึงปลายทาง", "error");
                setTimeout(() => showNotification("กรุณาลองใหม่อีกครั้ง", "info"), 1000);
                ui.submitButton.reset();
            },
            complete: () => {
                ui.overlay.hide();
                state.isSubmitting = false;
            }
        });
    },

    reset() {
        $("#surveyForm")[0].reset();
        $(".charCount").text("0").removeClass('text-[color:var(--accent-color)]');
        ui.submitButton.reset();
        ui.overlay.hide();
    },

    clear() {
        $('input[type="radio"], input[type="checkbox"]').prop('checked', false);
        $('input[type="text"], textarea').val('');
        $(".charCount").text("0").removeClass('text-[color:var(--accent-color)]');
        showNotification("ล้างข้อมูลในฟอร์มเรียบร้อยแล้ว", "success");
        navigation.previous();
    }
};

// ===== UI Components =====
const ui = {
    submitButton: {
        loading() {
            $("#submitBtn").prop("disabled", true);
            $("#submitText").text("กำลังส่ง");
            $("#submitIcon").attr("class", "fa-solid fa-circle-notch fa-spin");
        },
        reset() {
            $("#submitBtn").prop("disabled", false);
            $("#submitText").text("ส่งแบบประเมิน");
            $("#submitIcon").attr("class", "fa-solid fa-location-arrow");
        }
    },

    overlay: {
        show() {
            $("body").append(`
                <div id="formOverlay" class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
                <p class="slide-up fa-bounce absolute bottom-56 text-sm sm:text-base bg-[color:var(--white-smoker)] border rounded-xl text-lg px-2">
                รอแปป&#8201;เจ้าหน้าที่กำลังบินไปส่งงง
                </p>
                <div class="clouds">
                <div class="cloud cloud1"></div>
                <div class="cloud cloud2"></div>
                <div class="cloud cloud3"></div>
                <div class="cloud cloud4"></div>
                <div class="cloud cloud5"></div>
                </div>
                <div class="loader enter" id="loader">
                <span><span></span><span></span><span></span><span></span></span>
                <div class="base"><span></span><div class="face"></div></div>
                </div>
                <div class="longfazers">
                <span></span><span></span><span></span><span></span>
                </div>
                </div>
                `);
        },
        hide() {
            $('#formOverlay').fadeOut(700, function () {
                $(this).remove();
            });
        }
    }
};

// ===== Modals =====
const modal = {
    success(data) {
        $('main').html(`
            <div id="successModalOverlay" class="fixed inset-0 flex flex-col items-center justify-center bg-black bg-opacity-50 p-2 sm:p-4 z-50 touch-none">
            <div class="slide-up relative w-full max-w-lg flex flex-col bg-[color:var(--white-smoker)] border rounded-2xl shadow p-4 sm:p-6 max-h-[80vh]">
            <i class="stamp-icon fas fa-id-card absolute -top-4 -right-4 text-8xl sm:text-9xl text-[color:var(--primary-color)] drop-shadow-lg"></i>
            <span class="size-16 flex items-center justify-center bg-green-100 border rounded-full shadow-inner mx-auto mb-6">
            <i class="fa-solid fa-check fa-bounce text-2xl text-green-500"></i>
            </span>
            <span class="space-y-2 text-center">
            <h3 class="text-lg sm:text-xl text-gray-800">ขอบคุณสำหรับการประเมิน!</h3>
            <p class="text-sm sm:text-base text-gray-600">เราได้รับข้อมูลของคุณเรียบร้อยแล้ว&#8201;และจะดำเนินการต่อไป</p>
            </span>
            <div class="flex flex-row items-center gap-2 mt-6">
            <button id="viewDataBtn" class="btn-outline flex-1 text-sm sm:text-base overflow-hidden">ดูแบบประเมินของคุณ</button>
            </div>
            </div>
            <div id="teamContainer" class="slide-up w-full max-w-lg bg-[color:var(--white-smoker)] border rounded-2xl shadow m-4 p-4 sm:p-6 max-h-[80vh] overflow-y-auto">
            <h3 class="text-lg sm:text-xl text-gray-800 mb-4">ทีมผู้พัฒนา</h3>
            <div id="team" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div id="loadingTeam" class="col-span-full w-full flex flex-col items-center justify-center space-y-2">
            <span class="spinner animate-spin size-8 border-4 mb-4"></span>
            <p class="text-sm sm:text-base text-gray-600">กำลังตามล่าทีมผู้พัฒนา...&#8201;แม่งหายไปไหนอีกละ</p>
            </div>
            </div>
            </div>
            </div>
            `);

        $('#viewDataBtn').on('click', () => modal.showData());
        loadTeamGitHub();
    },

    showData() {
        const projectTitle = $("#project-name").text() || document.title || "แบบประเมิน";

        const dataHTML = Object.entries(state.submittedData)
            .map(([key, value]) => `
            <div class="text-left border-b pb-2">
            <p class="text-xs sm:text-sm text-gray-500">${utils.getLabel(key)}</p>
            <p class="text-sm sm:text-base text-gray-800 break-words whitespace-pre-wrap">${utils.formatValue(value)}</p>
            </div>
            `).join('');

        $('#successModalOverlay').fadeOut(700, function () {
            $(this).remove();
        });

        $('main').html(`
            <div id="dataModalOverlay" class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 p-2 sm:p-4 z-50 touch-none">
            <div class="slide-up relative h-full w-full max-w-lg flex flex-col bg-[color:var(--white-smoker)] border rounded-2xl shadow p-4 sm:p-6 max-h-[80vh]">
            <i class="fa-solid fa-certificate fa-spin absolute -top-12 -right-12 text-8xl sm:text-9xl text-[color:var(--primary-color)] drop-shadow-lg"></i>
            <div class="flex flex-col gap-2 mb-4">
            <h3 class="text-lg sm:text-xl text-gray-800">ข้อมูลแบบประเมินของคุณ</h3>
            <span class="flex items-center gap-2 text-sm sm:text-base font-medium text-gray-800">
            <p>โปรเจค</p>
            <p class="text-[color:var(--primary-color)]">${projectTitle}</p>
            </span>
            </div>
            <div class="bg-gray-50 border rounded-lg shadow-inner p-4 overflow-y-auto flex-1">
            <div class="space-y-2">${dataHTML}</div>
            </div>
            <div class="flex flex-row items-center gap-2 mt-6">
            <button id="downloadDataBtn" class="btn-outline flex-1 flex items-center justify-center gap-2 text-sm sm:text-base overflow-hidden">
            <i class="fa-solid fa-download"></i>
            <span>ดาวน์โหลด</span>
            </button>
            </div>
            </div>
            </div>
            `);

        $('#downloadDataBtn').on('click', modal.download);
    },

    download() {
        const projectTitle = $("#project-name").text() || document.title || "แบบประเมิน";

        let text = `แบบประเมินของคุณ\n${"=".repeat(50)}\nโปรเจค: ${projectTitle}\n${"=".repeat(50)}\n\n`;

        Object.entries(state.submittedData).forEach(([key, value]) => {
            text += `${utils.getLabel(key)}: ${utils.formatValue(value)}\n`;
        });

        text += `\n${"=".repeat(50)}\nวันที่ส่ง: ${new Date().toLocaleString('th-TH')}`;

        const blob = new Blob([text], {
            type: 'text/plain;charset=utf-8'
        });
        const url = window.URL.createObjectURL(blob);
        const $a = $('<a></a>').attr({
            href: url, download: `${projectTitle}_${Date.now()}.txt`
        }).appendTo('body');

        $a[0].click();
        $a.remove();
        window.URL.revokeObjectURL(url);

        showNotification("ดาวน์โหลดสำเร็จ!", "success");
    }
};

// ===== Event Handlers =====
$(document).ready(function () {
    // Input sanitization & privileged mode
    $("#name").on("input", function () {
        $(this).val(utils.sanitize($(this).val()));
        utils.isPrivileged() ? privileged.grant() : privileged.revoke();
    });

    $("#comments").on("input", function () {
        if (!utils.isPrivileged()) {
            $(this).val(utils.sanitize($(this).val()));
        }
    });

    // Form submission
    $("#surveyForm").on("submit",
        function (e) {
            e.preventDefault();

            if (state.isSubmitting) return;

            if (!utils.isPrivileged()) {
                const valid1 = validation.checkSection(1);
                const valid2 = validation.checkSection(2);

                if (!valid1 || !valid2) {
                    if (!valid1) navigation.previous();
                    return;
                }
            }

            state.isSubmitting = true;
            ui.submitButton.loading();
            ui.overlay.show();

            form.submit(new FormData(this));
        });

    // Clear form
    $("[id='ClearForm']").on("click",
        function () {
            form.clear();
        });

    // Radio button effects
    $(document).on('change',
        'input[type="radio"]',
        function () {
            const $container = $(this).closest('.grid, .flex');
            if (!$container.length) return;

            $container.find('label').css('transform', '');
            const $label = $(this).closest('label');
            $label.css('transform', 'scale(1.02)');
            setTimeout(() => $label.css('transform', ''), 150);
        });

    // Prevent Enter key (except in textarea)
    $(document).on('keydown',
        function (e) {
            if (e.key === 'Enter' && !$(e.target).is('textarea')) {
                e.preventDefault();
            }
        });

    // Welcome message
    showNotification(welcomeMessage);
    setTimeout(() => showNotification(utils.random(MESSAGES.welcome)),
        1500);

    // Mascot animation
    setTimeout(() => {
        $("#mascot").css({
            opacity: "0",
            transform: "translateX(100%)",
            transition: "opacity 1s ease, transform 1s ease"
        });
    },
        3000);

    $("#mascot").on("click",
        function () {
            $(this).css({
                opacity: "0",
                transform: "translateX(100%)",
                transition: "opacity 500ms ease, transform 500ms ease"
            });
            setTimeout(() => $(this).remove(), 500);
        });

    // Initialize
    if (utils.isPrivileged()) privileged.grant();
    counter.init();
});

// Expose navigation functions globally
window.nextStep = navigation.next;
window.previousStep = navigation.previous;