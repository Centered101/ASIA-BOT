let noImages = "https://project-test-submission.netlify.app/images/img/noitems.svg";

$("body").html(`
<body draggable="false" oncontextmenu="return false">
    <!-- Preloader -->
    <div id="preloader"
        class="bg-stripes-gray visible touch-none min-h-screen fixed inset-0 flex items-center justify-center text-center bg-gray-50 z-50">
        <span class="spinner animate-spin size-80 fixed border-8" style="animation-duration: 1s;"></span>
        <div
            class="size-80 flex flex-col items-center justify-center gap-2 bg-[color:var(--white-smoker)] rounded-full shadow">
            <img src="/favicon.ico" onerror="this.src='https://asia-lb.firebaseapp.com/images/favicon.svg'" alt="logo"
                class="size-16 fa-bounce drop-shadow" draggable="false">
            <h2 class="text-xl sm:text-2xl">กำลังโหลด</h2>
            <p class="text-sm sm:text-base text-gray-600">
                การผจญภัยของคุณกำลังจะเริ่มต้น
            </p>
        </div>
        <div class="bg-blob" style="width:520px;height:520px;background:var(--primary-color);top:-120px;right:-170px;">
        </div>
        <div class="bg-blob" style="width:420px;height:420px;background:var(--primary-dark);bottom:-110px;left:-130px;">
        </div>
    </div>

    <!-- Decorative blobs -->
    <div class="bg-blob" style="width:520px;height:520px;background:var(--primary-color);top:-120px;right:-170px;">
    </div>
    <div class="bg-blob" style="width:420px;height:420px;background:var(--primary-dark);bottom:-110px;left:-130px;">
    </div>

    <!-- Message Container -->
    <img id="mascot" class="md:max-w-xl fixed bottom-0 right-0 flex items-center object-center object-contain select-none cursor-pointer z-40" draggable="false" />

    <main class="w-full min-h-screen flex flex-col justify-center items-center gap-6 p-2 sm:p-4 py-6">

    <div data-aos="fade-up" data-aos-duration="2000" class="w-full max-w-2xl bg-white rounded-2xl shadow p-4 md:p-6">
    <!-- Logo -->
    <div class="text-center space-y-2 mb-6 p-2">
    <div class="size-16 sm:size-24 flex items-center justify-center bg-[color:var(--primary-color)] rounded-full shadow-inner mx-auto p-1">
    <img src="/images/school-logo.svg" onerror="this.src='https://asia-lb.firebaseapp.com/favicon.ico'" draggable="false" />
    </div>
    <h1 class="text-xl sm:text-2xl font-bold text-gray-800">แบบประเมินความพึงพอใจ</h1>
    <p class="text-sm sm:text-base text-gray-600">กรุณาให้คะแนนและความคิดเห็นของคุณ</p>
    <div class="text-xs sm:text-sm text-gray-500">ขั้นตอนที่&#8201;<span id="currentStep" class="text-[color:var(--primary-color)]">1</span>&#8201;จาก&#8201;2</div>
    <h2 id="project-name" class="text-lg sm:text-xl text-[color:var(--primary-color)]">ไม่ได้เชื่อมต่อโปรเจค</h2>
    </div>

    <form id="surveyForm" method="post" class="space-y-6">
    <!-- Section 1: Personal Info -->
    <section id="section1" class="space-y-6">

    <img id="poster" class="rounded-xl" loading="lazy" draggable="false" style="background-image: url('${noImages}'); background-size: cover; background-position: center;" onerror="this.onerror=null;this.src='${noImages}';">

    <!-- Emoji Rating -->
    <div class="space-y-4">
    <div>
    <p class="text-sm sm:text-base text-gray-700 font-medium">อิโมจิ&#8201;ความรู้สึกของคุณ</p>
    </div>
    <div class="flex items-center justify-evenly gap-2 bg-[color:var(--primary-color)] border-2 rounded-lg shadow-inner p-2 overflow-hidden">
    <!-- 😀 -->
    <label for="emoji_3" class="relative size-12 flex items-center justify-center rounded-full shadow">
    <input name="emotion" type="radio" value="3" id="emoji_3" class="peer hidden size-full z-20">
    <div class="absolute size-full bg-green-100 rounded-full p-2 shadow-sm ring-green-400 duration-300 z-10 peer-checked:scale-110 peer-checked:ring-2"></div>
    <div class="absolute size-full bg-green-200 rounded-full scale-0 duration-700 peer-checked:scale-[500%]"></div>
    <span class="absolute text-2xl sm:text-3xl z-10">😀</span>
    </label>
    <!-- 😐 -->
    <label for="emoji_2" class="relative size-12 flex items-center justify-center rounded-full shadow">
    <input name="emotion" type="radio" value="2" id="emoji_2" class="peer hidden size-full z-20">
    <div class="absolute size-full bg-yellow-100 rounded-full p-2 shadow-sm ring-yellow-400 duration-300 z-10 peer-checked:scale-110 peer-checked:ring-2"></div>
    <div class="absolute size-full bg-yellow-200 rounded-full scale-0 duration-700 peer-checked:scale-[500%]"></div>
    <span class="absolute text-2xl sm:text-3xl z-10">😐</span>
    </label>
    <!-- 😣 -->
    <label for="emoji_1" class="relative size-12 flex items-center justify-center rounded-full shadow">
    <input name="emotion" type="radio" value="1" id="emoji_1"class="peer hidden size-full z-20">
    <div class="absolute size-full bg-red-100 rounded-full p-2 shadow-sm ring-red-400 duration-300 z-10 peer-checked:scale-110 peer-checked:ring-2"></div>
    <div class="absolute size-full bg-red-200 rounded-full scale-0 duration-700 peer-checked:scale-[500%]"></div>
    <span class="absolute text-2xl sm:text-3xl z-10">😣</span>
    </label>
    </div>
    </div>

    <!-- Gender Selection -->
    <div class="space-y-4">
    <label for="gender" class="block">
    <p class="text-sm sm:text-base text-gray-700 font-medium">เลือกเพศของคุณ&#8201;<span class="text-[color:var(--accent-color)]">*</span></p>
    </label>
    <div class="grid grid-cols-3 gap-2">
    <label for="gender_male" class="ripple-effect bg-gray-50 flex items-center justify-evenly gap-1 py-4 border-2 rounded-lg transition-colors hover:border-[color:var(--primary-color)]">
    <input id="gender_male" name="gender" type="radio" value="ชาย" class="hidden peer" required>
    <div class="size-6 flex items-center justify-center bg-white border-2 rounded-full peer-checked:bg-[color:var(--primary-color)] *:peer-checked:opacity-100">
    <i class="fas fa-check text-white text-xs opacity-0"></i>
    </div>
    <span class="text-sm sm:text-base text-gray-700">ชาย</span>
    </label>
    <label for="gender_female" class="ripple-effect bg-gray-50 flex items-center justify-evenly gap-1 py-4 border-2 rounded-lg transition-colors hover:border-[color:var(--primary-color)]">
    <input id="gender_female" name="gender" type="radio" value="หญิง" class="hidden peer" required>
    <div class="size-6 flex items-center justify-center bg-white border-2 rounded-full peer-checked:bg-[color:var(--primary-color)] *:peer-checked:opacity-100">
    <i class="fas fa-check text-white text-xs opacity-0"></i>
    </div>
    <span class="text-sm sm:text-base text-gray-700">หญิง</span>
    </label>
    <label for="gender_other" class="ripple-effect bg-gray-50 flex items-center justify-evenly gap-1 py-4 border-2 rounded-lg transition-colors hover:border-[color:var(--primary-color)]">
    <input id="gender_other" name="gender" type="radio" value="อื่นๆ" class="hidden peer" required>
    <div class="size-6 flex items-center justify-center bg-white border-2 rounded-full peer-checked:bg-[color:var(--primary-color)] *:peer-checked:opacity-100">
    <i class="fas fa-check text-white text-xs opacity-0"></i>
    </div>
    <span class="text-sm sm:text-base text-gray-700">อื่นๆ</span>
    </label>
    </div>
    </div>

    <!-- Evaluator Selection -->
    <div class="space-y-4">
    <label class="block text-sm sm:text-base text-gray-600">สถานะผู้ประเมิน&#8201;<span class="text-[color:var(--accent-color)]">*</span></p></label>
    <select id="kindergartenSelectBox" name="" required class="w-full p-4 text-sm sm:text-base border-2 rounded-lg bg-gray-50 focus:outline-none focus:border-[color:var(--primary-color)]">
    <option value="" disabled selected>-- เลือก --</option>
    <option value="ผู้ปกครอง">ผู้ปกครอง</option>
    <option value="ครู">ครู/อาจารย์</option>
    <option value="นักเรียน">นักเรียน/นักศึกษา</option>
    <option value="บุคคลทั่วไป">บุคคลทั่วไป</option>
    </select>
    </div>

    <!-- Name Input -->
    <div class="space-y-4">
    <label for="name" class="block">
    <p class="text-sm sm:text-base text-gray-700 font-medium">ชื่อ&#8201;-&#8201;นามสกุล&#8201;<span class="text-[color:var(--accent-color)]">*</span></p>
    </label>
    <input id="name" name="" type="text" placeholder="ระบุ&#8201;ชื่อ&#8201;-&#8201;นามสกุล" maxlength="60" required oncontextmenu="return true"; class="w-full text-sm sm:text-base bg-gray-50 border-2 rounded-lg p-4 transition-colors focus:border-[color:var(--primary-color)] focus:outline-none">
    </div>

    <div class="flex items-center justify-between gap-2 text-xs sm:text-sm text-gray-500">
    <p id="ClearForm" class="btn-text text-[color:var(--accent-color)]">ล้างแบบฟอร์ม</p>
    <p><span id="countName" class="charCount">0</span>/60&#8201;ตัวอักษร</p>
    </div>

    <button type="button" onclick="nextStep()" class="btn-primary w-full flex items-center justify-center gap-2 text-sm sm:text-base overflow-hidden">
    <span class="line-clamp-1">ถัดไป</span>
    <i class="fas fa-arrow-right"></i>
    </button>
    </section>

    <!-- Section 2: Evaluation -->
    <section id="section2" class="space-y-6 hidden">

    <img id="preview" class="rounded-xl" draggable="false" />

    <!-- About Projects -->
    <div class="space-y-4">
    <div>
    <p class="text-sm sm:text-base text-gray-700 font-medium">เกี่ยวกับโปรเจค</p>
    </div>
    <p id="description" class="text-sm sm:text-base text-gray-600 border-l-4 border-[color:var(--primary-color)] pl-2"></p>
    </div>

    <!-- Satisfaction Rating -->
    <!-- Criterion 1 -->
    <div class="space-y-4">
    <div class="block">
    <p class="text-sm sm:text-base text-gray-700 font-medium">1&#8201;ความคิดสร้างสรรค์&#8201;<span class="text-[color:var(--accent-color)]">*</span></p>
    </div>
    <div class="grid grid-cols-5 gap-2">
    <label for="creative_5" class="ripple-effect bg-gray-50 flex flex-col items-center gap-1 border-2 rounded-lg p-1 sm:p-2 transition-colors hover:border-[color:var(--primary-color)]">
    <input id="creative_5" name="satisfaction" type="radio" value="5" class="hidden peer" required>
    <i class="fas fa-smile-beam text-xl sm:text-2xl text-gray-300 transition-colors peer-checked:text-green-500"></i>
    <span class="text-xs text-gray-700 text-center">พอใจมาก</span>
    </label>
    <label for="creative_4" class="ripple-effect bg-gray-50 flex flex-col items-center gap-1 border-2 rounded-lg p-1 sm:p-2 transition-colors hover:border-[color:var(--primary-color)]">
    <input id="creative_4" name="satisfaction" type="radio" value="4" class="hidden peer" required>
    <i class="fas fa-smile text-xl sm:text-2xl text-gray-300 transition-colors peer-checked:text-blue-500"></i>
    <span class="text-xs text-gray-700 text-center">พอใจ</span>
    </label>
    <label for="creative_3" class="ripple-effect bg-gray-50 flex flex-col items-center gap-1 border-2 rounded-lg p-1 sm:p-2 transition-colors hover:border-[color:var(--primary-color)]">
    <input id="creative_3" name="satisfaction" type="radio" value="3" class="hidden peer" required>
    <i class="fas fa-meh text-xl sm:text-2xl text-gray-300 transition-colors peer-checked:text-yellow-500"></i>
    <span class="text-xs text-gray-700 text-center">ปานกลาง</span>
    </label>
    <label for="creative_2" class="ripple-effect bg-gray-50 flex flex-col items-center gap-1 border-2 rounded-lg p-1 sm:p-2 transition-colors hover:border-[color:var(--primary-color)]">
    <input id="creative_2" name="satisfaction" type="radio" value="2" class="hidden peer" required>
    <i class="fas fa-frown text-xl sm:text-2xl text-gray-300 transition-colors peer-checked:text-orange-500"></i>
    <span class="text-xs text-gray-700 text-center">ไม่พอใจ</span>
    </label>
    <label for="creative_1" class="ripple-effect bg-gray-50 flex flex-col items-center gap-1 border-2 rounded-lg p-1 sm:p-2 transition-colors hover:border-[color:var(--primary-color)]">
    <input id="creative_1" name="satisfaction" type="radio" value="1" class="hidden peer" required>
    <i class="fas fa-angry text-xl sm:text-2xl text-gray-300 transition-colors peer-checked:text-red-500"></i>
    <span class="text-xs text-gray-700 text-center">ไม่พอใจมาก</span>
    </label>
    </div>
    </div>

    <!-- Criterion 2 -->
    <div class="space-y-4">
    <div class="block">
    <p class="text-sm sm:text-base text-gray-700 font-medium">2&#8201;ความเหมาะสมของเนื้อหา&#8201;<span class="text-[color:var(--accent-color)]">*</span></p>
    </div>
    <div class="grid grid-cols-5 gap-2">
    <label for="content_5" class="ripple-effect bg-gray-50 flex flex-col items-center gap-1 border-2 rounded-lg p-1 sm:p-2 transition-colors hover:border-[color:var(--primary-color)]">
    <input id="content_5" name="satisfaction" type="radio" value="5" class="hidden peer" required>
    <i class="fas fa-smile-beam text-xl sm:text-2xl text-gray-300 transition-colors peer-checked:text-green-500"></i>
    <span class="text-xs text-gray-700 text-center">พอใจมาก</span>
    </label>
    <label for="content_4" class="ripple-effect bg-gray-50 flex flex-col items-center gap-1 border-2 rounded-lg p-1 sm:p-2 transition-colors hover:border-[color:var(--primary-color)]">
    <input id="content_4" name="satisfaction" type="radio" value="4" class="hidden peer" required>
    <i class="fas fa-smile text-xl sm:text-2xl text-gray-300 transition-colors peer-checked:text-blue-500"></i>
    <span class="text-xs text-gray-700 text-center">พอใจ</span>
    </label>
    <label for="content_3" class="ripple-effect bg-gray-50 flex flex-col items-center gap-1 border-2 rounded-lg p-1 sm:p-2 transition-colors hover:border-[color:var(--primary-color)]">
    <input id="content_3" name="satisfaction" type="radio" value="3" class="hidden peer" required>
    <i class="fas fa-meh text-xl sm:text-2xl text-gray-300 transition-colors peer-checked:text-yellow-500"></i>
    <span class="text-xs text-gray-700 text-center">ปานกลาง</span>
    </label>
    <label for="content_2" class="ripple-effect bg-gray-50 flex flex-col items-center gap-1 border-2 rounded-lg p-1 sm:p-2 transition-colors hover:border-[color:var(--primary-color)]">
    <input id="content_2" name="satisfaction" type="radio" value="2" class="hidden peer" required>
    <i class="fas fa-frown text-xl sm:text-2xl text-gray-300 transition-colors peer-checked:text-orange-500"></i>
    <span class="text-xs text-gray-700 text-center">ไม่พอใจ</span>
    </label>
    <label for="content_1" class="ripple-effect bg-gray-50 flex flex-col items-center gap-1 border-2 rounded-lg p-1 sm:p-2 transition-colors hover:border-[color:var(--primary-color)]">
    <input id="content_1" name="satisfaction" type="radio" value="1" class="hidden peer" required>
    <i class="fas fa-angry text-xl sm:text-2xl text-gray-300 transition-colors peer-checked:text-red-500"></i>
    <span class="text-xs text-gray-700 text-center">ไม่พอใจมาก</span>
    </label>
    </div>
    </div>

    <!-- Criterion 3 -->
    <div class="space-y-4">
    <div class="block">
    <p class="text-sm sm:text-base text-gray-700 font-medium">3&#8201;การนำเสนอ&#8201;<span class="text-[color:var(--accent-color)]">*</span></p>
    </div>
    <div class="grid grid-cols-5 gap-2">
    <label for="presentation_5" class="ripple-effect bg-gray-50 flex flex-col items-center gap-1 border-2 rounded-lg p-1 sm:p-2 transition-colors hover:border-[color:var(--primary-color)]">
    <input id="presentation_5" name="satisfaction" type="radio" value="5" class="hidden peer" required>
    <i class="fas fa-smile-beam text-xl sm:text-2xl text-gray-300 transition-colors peer-checked:text-green-500"></i>
    <span class="text-xs text-gray-700 text-center">พอใจมาก</span>
    </label>
    <label for="presentation_4" class="ripple-effect bg-gray-50 flex flex-col items-center gap-1 border-2 rounded-lg p-1 sm:p-2 transition-colors hover:border-[color:var(--primary-color)]">
    <input id="presentation_4" name="satisfaction" type="radio" value="4" class="hidden peer" required>
    <i class="fas fa-smile text-xl sm:text-2xl text-gray-300 transition-colors peer-checked:text-blue-500"></i>
    <span class="text-xs text-gray-700 text-center">พอใจ</span>
    </label>
    <label for="presentation_3" class="ripple-effect bg-gray-50 flex flex-col items-center gap-1 border-2 rounded-lg p-1 sm:p-2 transition-colors hover:border-[color:var(--primary-color)]">
    <input id="presentation_3" name="satisfaction" type="radio" value="3" class="hidden peer" required>
    <i class="fas fa-meh text-xl sm:text-2xl text-gray-300 transition-colors peer-checked:text-yellow-500"></i>
    <span class="text-xs text-gray-700 text-center">ปานกลาง</span>
    </label>
    <label for="presentation_2" class="ripple-effect bg-gray-50 flex flex-col items-center gap-1 border-2 rounded-lg p-1 sm:p-2 transition-colors hover:border-[color:var(--primary-color)]">
    <input id="presentation_2" name="satisfaction" type="radio" value="2" class="hidden peer" required>
    <i class="fas fa-frown text-xl sm:text-2xl text-gray-300 transition-colors peer-checked:text-orange-500"></i>
    <span class="text-xs text-gray-700 text-center">ไม่พอใจ</span>
    </label>
    <label for="presentation_1" class="ripple-effect bg-gray-50 flex flex-col items-center gap-1 border-2 rounded-lg p-1 sm:p-2 transition-colors hover:border-[color:var(--primary-color)]">
    <input id="presentation_1" name="satisfaction" type="radio" value="1" class="hidden peer" required>
    <i class="fas fa-angry text-xl sm:text-2xl text-gray-300 transition-colors peer-checked:text-red-500"></i>
    <span class="text-xs text-gray-700 text-center">ไม่พอใจมาก</span>
    </label>
    </div>
    </div>

    <!-- Criterion 4 -->
    <div class="space-y-4">
    <div class="block">
    <p class="text-sm sm:text-base text-gray-700 font-medium">4&#8201;การนำไปใช้งานจริง&#8201;<span class="text-[color:var(--accent-color)]">*</span></p>
    </div>
    <div class="grid grid-cols-5 gap-2">
    <label for="usability_5" class="ripple-effect bg-gray-50 flex flex-col items-center gap-1 border-2 rounded-lg p-1 sm:p-2 transition-colors hover:border-[color:var(--primary-color)]">
    <input id="usability_5" name="satisfaction" type="radio" value="5" class="hidden peer" required>
    <i class="fas fa-smile-beam text-xl sm:text-2xl text-gray-300 transition-colors peer-checked:text-green-500"></i>
    <span class="text-xs text-gray-700 text-center">พอใจมาก</span>
    </label>
    <label for="usability_4" class="ripple-effect bg-gray-50 flex flex-col items-center gap-1 border-2 rounded-lg p-1 sm:p-2 transition-colors hover:border-[color:var(--primary-color)]">
    <input id="usability_4" name="satisfaction" type="radio" value="4" class="hidden peer" required>
    <i class="fas fa-smile text-xl sm:text-2xl text-gray-300 transition-colors peer-checked:text-blue-500"></i>
    <span class="text-xs text-gray-700 text-center">พอใจ</span>
    </label>
    <label for="usability_3" class="ripple-effect bg-gray-50 flex flex-col items-center gap-1 border-2 rounded-lg p-1 sm:p-2 transition-colors hover:border-[color:var(--primary-color)]">
    <input id="usability_3" name="satisfaction" type="radio" value="3" class="hidden peer" required>
    <i class="fas fa-meh text-xl sm:text-2xl text-gray-300 transition-colors peer-checked:text-yellow-500"></i>
    <span class="text-xs text-gray-700 text-center">ปานกลาง</span>
    </label>
    <label for="usability_2" class="ripple-effect bg-gray-50 flex flex-col items-center gap-1 border-2 rounded-lg p-1 sm:p-2 transition-colors hover:border-[color:var(--primary-color)]">
    <input id="usability_2" name="satisfaction" type="radio" value="2" class="hidden peer" required>
    <i class="fas fa-frown text-xl sm:text-2xl text-gray-300 transition-colors peer-checked:text-orange-500"></i>
    <span class="text-xs text-gray-700 text-center">ไม่พอใจ</span>
    </label>
    <label for="usability_1" class="ripple-effect bg-gray-50 flex flex-col items-center gap-1 border-2 rounded-lg p-1 sm:p-2 transition-colors hover:border-[color:var(--primary-color)]">
    <input id="usability_1" name="satisfaction" type="radio" value="1" class="hidden peer" required>
    <i class="fas fa-angry text-xl sm:text-2xl text-gray-300 transition-colors peer-checked:text-red-500"></i>
    <span class="text-xs text-gray-700 text-center">ไม่พอใจมาก</span>
    </label>
    </div>
    </div>

    <!-- Criterion 5 -->
    <div class="space-y-4">
    <div class="block">
    <p class="text-sm sm:text-base text-gray-700 font-medium">ระดับความพึงพอใจโดยรวม&#8201;<span class="text-[color:var(--accent-color)]">*</span></p>
    </div>
    <div class="grid grid-cols-5 gap-2">
    <label for="overall_5" class="ripple-effect bg-gray-50 flex flex-col items-center gap-1 border-2 rounded-lg p-1 sm:p-2 transition-colors hover:border-[color:var(--primary-color)]">
    <input id="overall_5" name="satisfaction" type="radio" value="5" class="hidden peer" required>
    <i class="fas fa-smile-beam text-xl sm:text-2xl text-gray-300 transition-colors peer-checked:text-green-500"></i>
    <span class="text-xs text-gray-700 text-center">พอใจมาก</span>
    </label>
    <label for="overall_4" class="ripple-effect bg-gray-50 flex flex-col items-center gap-1 border-2 rounded-lg p-1 sm:p-2 transition-colors hover:border-[color:var(--primary-color)]">
    <input id="overall_4" name="satisfaction" type="radio" value="4" class="hidden peer" required>
    <i class="fas fa-smile text-xl sm:text-2xl text-gray-300 transition-colors peer-checked:text-blue-500"></i>
    <span class="text-xs text-gray-700 text-center">พอใจ</span>
    </label>
    <label for="overall_3" class="ripple-effect bg-gray-50 flex flex-col items-center gap-1 border-2 rounded-lg p-1 sm:p-2 transition-colors hover:border-[color:var(--primary-color)]">
    <input id="overall_3" name="satisfaction" type="radio" value="3" class="hidden peer" required>
    <i class="fas fa-meh text-xl sm:text-2xl text-gray-300 transition-colors peer-checked:text-yellow-500"></i>
    <span class="text-xs text-gray-700 text-center">ปานกลาง</span>
    </label>
    <label for="overall_2" class="ripple-effect bg-gray-50 flex flex-col items-center gap-1 border-2 rounded-lg p-1 sm:p-2 transition-colors hover:border-[color:var(--primary-color)]">
    <input id="overall_2" name="satisfaction" type="radio" value="2" class="hidden peer" required>
    <i class="fas fa-frown text-xl sm:text-2xl text-gray-300 transition-colors peer-checked:text-orange-500"></i>
    <span class="text-xs text-gray-700 text-center">ไม่พอใจ</span>
    </label>
    <label for="overall_1" class="ripple-effect bg-gray-50 flex flex-col items-center gap-1 border-2 rounded-lg p-1 sm:p-2 transition-colors hover:border-[color:var(--primary-color)]">
    <input id="overall_1" name="satisfaction" type="radio" value="1" class="hidden peer" required>
    <i class="fas fa-angry text-xl sm:text-2xl text-gray-300 transition-colors peer-checked:text-red-500"></i>
    <span class="text-xs text-gray-700 text-center">ไม่พอใจมาก</span>
    </label>
    </div>
    </div>

    <!-- Comments -->
    <div class="space-y-4">
    <label for="comments" class="block">
    <p class="text-sm sm:text-base text-gray-700 font-medium">ความคิดเห็นเพิ่มเติม</p>
    </label>
    <textarea id="comments" name="" placeholder="แชร์ความคิดเห็นหรือข้อเสนอแนะของคุณ..." rows="4" maxlength="450" oncontextmenu="return true"; class="w-full text-sm sm:text-base bg-gray-50 border-2 rounded-lg p-4 transition-colors resize-none focus:border-[color:var(--primary-color)] focus:outline-none"></textarea>
    </div>

    <div class="flex items-center justify-between gap-2 text-xs sm:text-sm text-gray-500">
    <p id="ClearForm" class="btn-text text-[color:var(--accent-color)]">ล้างแบบฟอร์ม</p>
    <p><span id="countComments" class="charCount">0</span>/450&#8201;ตัวอักษร</p>
    </div>

    <!-- Navigation Buttons -->
    <div class="grid grid-cols-2 gap-2">
    <button type="button" onclick="previousStep()" class="btn-outline flex items-center justify-center gap-2 text-sm sm:text-base overflow-hidden">
    <i class="fas fa-arrow-left"></i>
    <span class="line-clamp-1">ย้อนกลับ</span>
    </button>
    <button type="submit" id="submitBtn" class="btn-primary flex items-center justify-center gap-2 text-sm sm:text-base overflow-hidden">
    <span id="submitText" class="line-clamp-1">ส่งแบบประเมิน</span>
    <i id="submitIcon" class="fa-solid fa-location-arrow"></i>
    </button>
    </div>

    </section>
    </form>
    </div>
    </main>
    `);