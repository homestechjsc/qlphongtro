import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, set, push, update, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyD0fDuyWWC51ih0qfl3QBAFJY6NOC-5hTA",
    authDomain: "quanlyphongtro-4bef6.firebaseapp.com",
    databaseURL: "https://quanlyphongtro-4bef6-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "quanlyphongtro-4bef6",
    storageBucket: "quanlyphongtro-4bef6.firebasestorage.app",
    messagingSenderId: "484406201867",
    appId: "1:484406201867:web:2abef5338a77487776010e",
    measurementId: "G-SJZ1SE8JF5"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
let rooms = [];
let allBills = [];
// Cấu hình mặc định
let config = { electric: 3500, water: 15000, internet: 50000, garbage: 30000, parking: 100000 };


// Lắng nghe dữ liệu cài đặt và tự động cập nhật giao diện
onValue(ref(db, 'settings'), (snapshot) => {
    if (snapshot.exists()) {
        config = snapshot.val(); // Cập nhật biến toàn cục
        
        // Kiểm tra nếu đang ở tab settings thì vẽ lại danh sách ngay
        const settingsView = document.getElementById('view-settings');
        if (settingsView && !settingsView.classList.contains('hidden')) {
            renderConfigSettings();
        }
    } else {
        // Nếu database trống, tạo giá trị mặc định để tránh lỗi
        config = { electric: 3500, water: 15000 };
    }
});

window.saveSettings = async () => {
    const newConfig = {
        electric: Number(document.getElementById('set-electric').value),
        water: Number(document.getElementById('set-water').value),
        internet: Number(document.getElementById('set-internet').value),
        garbage: Number(document.getElementById('set-garbage').value),
        parking: Number(document.getElementById('set-parking').value)
    };
    await set(ref(db, 'settings'), newConfig);
    alert("Đã cập nhật đơn giá thành công!");
};

// --- QUẢN LÝ TABS ---
window.switchTab = (tab) => {
    const views = ['dashboard', 'tenants', 'finance', 'settings'];
    views.forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if(el) el.classList.toggle('hidden', v !== tab);
    });

    // Nếu chuyển sang tab cài đặt, thực hiện vẽ danh sách chi phí
    if (tab === 'settings') {
        renderConfigSettings();
    }
    
    if (tab === 'finance') renderFinance();
};

// --- LOGIC CHỐT SỔ & TÍNH TIỀN ---
// 1. Hàm render chính cho tab Chốt sổ (Đã lược bỏ danh sách)
function renderFinance() {
    // Thay đổi ID container cho khớp với giao diện chính của bạn
    const container = document.getElementById('view-finance'); 
    if(!container) return;
    
    // Lấy danh sách các phòng đang có khách ở
    const activeRooms = rooms.filter(r => r.status === 'occupied');
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    container.innerHTML = `
        <div class="space-y-6 animate-in fade-in duration-500">
            <div class="flex justify-between items-center px-1">
                <h2 class="font-black text-slate-800 italic uppercase text-lg">Tính tiền & Chốt sổ</h2>
            </div>

            <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-5">
                <div class="grid grid-cols-2 gap-3">
                    <div class="space-y-1">
                        <label class="text-[9px] font-black text-slate-400 uppercase italic ml-2">Tháng chốt sổ</label>
                        <select id="financeMonth" class="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold text-slate-700 outline-none shadow-inner">
                            ${[...Array(12).keys()].map(i => `<option value="${i+1}" ${i+1 === currentMonth ? 'selected' : ''}>Tháng ${i+1}</option>`).join('')}
                        </select>
                    </div>
                    <div class="space-y-1">
                        <label class="text-[9px] font-black text-slate-400 uppercase italic ml-2">Năm</label>
                        <input type="number" id="financeYear" value="${currentYear}" class="w-full p-4 bg-slate-50 rounded-2xl border-none font-bold text-slate-700 outline-none shadow-inner">
                    </div>
                </div>

                <div class="space-y-1">
                    <label class="text-[9px] font-black text-slate-400 uppercase italic ml-2">Chọn phòng cần tính tiền</label>
                    <select id="selectRoomFinance" class="w-full p-4 bg-blue-50 rounded-2xl border-none font-black text-blue-600 outline-none shadow-md" onchange="renderSpecificRoomFinance(this.value)">
                        <option value="">-- Click để chọn số phòng --</option>
                        ${activeRooms.map(r => `<option value="${r.id}">Phòng ${r.roomNumber} - ${r.tenantName}</option>`).join('')}
                    </select>
                </div>
                
                <div id="roomFinanceDetail" class="min-h-[10px]"></div>
            </div>

            <div class="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-start gap-3">
                <i class="fa fa-info-circle text-blue-400 mt-1"></i>
                <p class="text-[10px] text-blue-600 font-bold leading-relaxed uppercase italic">
                    Sau khi nhấn "Thu tiền" hoặc "Lưu nợ", bạn có thể tra cứu lại hóa đơn tại Tab Hóa đơn bên cạnh.
                </p>
            </div>
        </div>
    `;
}

// Hàm mới để hiển thị chi tiết khi chọn phòng
window.renderSpecificRoomFinance = (id) => {
    const detailContainer = document.getElementById('roomFinanceDetail');
    if (!id) { detailContainer.innerHTML = ''; return; }
    
    const r = rooms.find(room => room.id === id);
    const month = parseInt(document.getElementById('financeMonth').value) || (new Date().getMonth() + 1);
    const year = parseInt(document.getElementById('financeYear').value) || new Date().getFullYear();

    const baseRoomPrice = Number(r.basePrice) || 0; 
    const startDate = r.checkInDate ? new Date(r.checkInDate) : new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    
    let firstMonthPrice = baseRoomPrice;
    if (startDate.getMonth() + 1 === month && startDate.getFullYear() === year) {
        const stayDays = daysInMonth - startDate.getDate() + 1;
        // Làm tròn về hàng nghìn (Ví dụ: 583.333 -> 583.000)
firstMonthPrice = daysInMonth > 0 ? Math.round(((baseRoomPrice / daysInMonth) * stayDays) / 1000) * 1000 : 0;
       
    }

    detailContainer.innerHTML = `
        <div class="mt-6 pt-6 border-t border-slate-100 space-y-5 animate-in fade-in duration-500">
            <div class="bg-blue-600 p-4 rounded-3xl text-white shadow-lg space-y-3">
                <div class="flex justify-between items-center">
                    <div>
                        <p class="text-[9px] font-black opacity-80 uppercase italic">Số tháng đóng tiền</p>
                        <input type="number" id="prepaidMonths" value="1" min="1" oninput="updateLiveTotal('${id}')"
                            class="w-16 p-2 bg-white/20 rounded-xl border-none font-black text-center text-white outline-none">
                    </div>
                    <div class="text-right">
                        <p class="text-[8px] font-bold opacity-60 uppercase">Tiền tháng đầu (${month})</p>
                        <p id="display-first-month" data-first="${firstMonthPrice}" data-base="${baseRoomPrice}" class="text-lg font-black italic">
                            ${firstMonthPrice.toLocaleString()}đ
                        </p>
                    </div>
                </div>
                <div class="pt-2 border-t border-white/10 flex justify-between items-center">
                    <label class="text-[9px] font-black opacity-80 uppercase italic text-yellow-300">Giảm giá trực tiếp</label>
                    <div class="flex items-center gap-2">
                        <input type="number" id="discountAmount" value="0" oninput="updateLiveTotal('${id}')"
                            class="w-24 p-2 bg-white/20 rounded-xl border-none font-black text-right text-white outline-none" placeholder="0">
                        <span class="text-[10px] font-bold uppercase italic">đ</span>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div class="space-y-1">
                    <label class="text-[9px] font-black text-slate-400 uppercase ml-2 italic">Điện (Cũ: ${r.lastElectric || 0})</label>
                    <input type="number" id="cur-e" oninput="updateLiveTotal('${id}')" class="w-full p-4 bg-slate-100 rounded-2xl border-none font-black text-blue-600 outline-none" placeholder="0">
                </div>
                <div class="space-y-1">
                    <label class="text-[9px] font-black text-slate-400 uppercase ml-2 italic">Nước (Cũ: ${r.lastWater || 0})</label>
                    <input type="number" id="cur-w" oninput="updateLiveTotal('${id}')" class="w-full p-4 bg-slate-100 rounded-2xl border-none font-black text-blue-600 outline-none" placeholder="0">
                </div>
            </div>

            <div id="serviceList" class="grid grid-cols-2 gap-2">
                ${Object.keys(config).filter(k => k !== 'electric' && k !== 'water').map(key => `
                    <label class="flex flex-col p-3 bg-white border border-slate-100 rounded-2xl cursor-pointer">
                        <div class="flex items-center gap-2 mb-1">
                            <input type="checkbox" checked onchange="updateLiveTotal('${id}')" class="service-check w-4 h-4 rounded-lg border-slate-200" data-key="${key}" data-val="${config[key]}">
                            <span class="text-[9px] font-bold text-slate-700 uppercase truncate">${key}</span>
                        </div>
                        <span class="text-[10px] font-black text-blue-600">${config[key].toLocaleString()}đ</span>
                    </label>
                `).join('')}
            </div>

            <div class="p-5 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 flex justify-between items-center">
                <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng tiền cần thu</span>
                <span id="liveTotal" class="text-xl font-black text-blue-700 italic">0đ</span>
            </div>

            <div class="grid grid-cols-2 gap-3 pt-2">
                <button onclick="finalizeBill('${id}', false)" class="py-4 bg-slate-200 text-slate-700 rounded-2xl font-black text-[10px] uppercase shadow-sm">Lưu nợ</button>
                <button onclick="finalizeBill('${id}', true)" class="py-4 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg">Thu tiền</button>
            </div>
        </div>
    `;
    setTimeout(() => updateLiveTotal(id), 50); 
};

window.updateLiveTotal = (roomId) => {
    const r = rooms.find(room => room.id === roomId);
    if (!r) return;

    const prepaidMonths = Math.max(1, Number(document.getElementById('prepaidMonths').value) || 1);
    const discount = Number(document.getElementById('discountAmount').value) || 0;
    const curE = Number(document.getElementById('cur-e').value) || (r.lastElectric || 0);
    const curW = Number(document.getElementById('cur-w').value) || (r.lastWater || 0);
    
    const displayEl = document.getElementById('display-first-month');
    const firstMonthPrice = Number(displayEl.getAttribute('data-first')) || 0;
    const basePrice = Number(displayEl.getAttribute('data-base')) || 0;

    // 1. Tổng tiền phòng (Tháng đầu lẻ + Các tháng sau nguyên giá)
    const roomTotal = firstMonthPrice + (basePrice * (prepaidMonths - 1));

    // 2. Tiền điện nước (Tính theo đơn giá trong config)
    const eCost = Math.max(0, (curE - (r.lastElectric || 0)) * (config.electric || 0));
    const wCost = Math.max(0, (curW - (r.lastWater || 0)) * (config.water || 0));

    // 3. Tiền dịch vụ (Tổng các dịch vụ được tick chọn)
    let servicesTotal = 0;
    document.querySelectorAll('.service-check:checked').forEach(cb => {
        servicesTotal += Number(cb.getAttribute('data-val')) || 0;
    });

    // 4. Tính tổng chưa làm tròn và trừ giảm giá
    const rawTotal = (roomTotal + eCost + wCost + servicesTotal) - discount;
    
    // 5. LÀM TRÒN VỀ HÀNG NGHÌN
    // Ví dụ: 793.333 -> 793.000
    const finalTotal = Math.max(0, Math.round(rawTotal / 1000) * 1000);
    
    const liveTotalEl = document.getElementById('liveTotal');
    if (liveTotalEl) {
        liveTotalEl.innerText = finalTotal.toLocaleString() + 'đ';
    }
};
window.generateBill = async (id) => {
    const r = rooms.find(room => room.id === id);
    const newE = Number(document.getElementById(`fin-e-${r.id}`).value);
    const newW = Number(document.getElementById(`fin-w-${r.id}`).value);
    
    if(!newE || newE < r.lastElectric) return alert("Số điện không hợp lệ!");

    const eCost = (newE - r.lastElectric) * config.electric;
    const wCost = (newW - (r.lastWater || 0)) * config.water;
    const services = config.internet + config.garbage + config.parking;
    const total = r.basePrice + eCost + wCost + services;
    const currentMonth = new Date().getMonth() + 1;

    await update(ref(db, `rooms/${id}`), {
        debtAmount: total,
        debtMonth: currentMonth,
        lastElectric: newE,
        lastWater: newW
    });
    alert(`Đã chốt bill P.${r.roomNumber}: ${total.toLocaleString()}đ`);
};

window.confirmFinalPayment = async (id) => {
    const method = document.getElementById('payMethod').value;
    await update(ref(db, `rooms/${id}`), {
        debtAmount: 0,
        debtMonth: null,
        lastPaymentMethod: method
    });
    alert("Thanh toán thành công!");
    closeModal();
};

// --- GIỮ NGUYÊN CÁC HÀM CŨ CỦA BẠN ---
function calculateStayDuration(startDate) {
    if (!startDate) return "N/A";
    const start = new Date(startDate);
    const today = new Date();
    const diffTime = Math.abs(today - start);
    return `${Math.ceil(diffTime / (1000 * 60 * 60 * 24))} ngày`;
}

window.toggleMaintenance = async (id) => {
    const r = rooms.find(room => room.id === id);
    const roomRef = ref(db, `rooms/${id}`);
    if (r.status !== 'maintenance') {
        await update(roomRef, { previousStatus: r.status, status: 'maintenance' });
    } else {
        const backStatus = r.previousStatus || 'empty';
        await update(roomRef, { status: backStatus, previousStatus: null });
    }
    closeModal();
};

window.openModal = (type, id = null) => {
    const modal = document.getElementById('mainModal');
    const content = document.getElementById('modalContent');
    modal.classList.remove('hidden');

    if (type === 'payment') {
        const r = rooms.find(room => room.id === id);
        content.innerHTML = `
            <h3 class="text-xl font-black mb-2 text-green-700 italic text-center">Thanh toán P.${r.roomNumber}</h3>
            <p class="text-center font-bold text-slate-500 mb-6 uppercase text-xs">Số tiền: ${r.debtAmount.toLocaleString()}đ</p>
            <div class="space-y-4">
                <select id="payMethod" class="w-full p-4 bg-slate-100 rounded-2xl outline-none font-bold text-blue-600 shadow-inner">
                    <option value="Chuyển khoản">Chuyển khoản / VietQR</option>
                    <option value="Tiền mặt">Tiền mặt</option>
                </select>
                <button onclick="confirmFinalPayment('${id}')" class="w-full py-4 bg-green-600 text-white rounded-2xl font-bold shadow-lg uppercase">Xác nhận đã thu</button>
                <button onclick="closeModal()" class="w-full py-2 text-slate-300 font-bold uppercase text-[10px]">Quay lại</button>
            </div>`;
    } else if (type === 'add-room' || type === 'edit-room') {
        const r = id ? rooms.find(room => room.id === id) : null;
        content.innerHTML = `<h3 class="text-xl font-black mb-4 text-slate-800 italic">${r ? 'Chỉnh sửa phòng' : 'Cấu trúc phòng mới'}</h3><div class="space-y-3"><input type="text" id="f-roomNum" value="${r ? r.roomNumber : ''}" placeholder="Số phòng" class="w-full p-3 bg-slate-100 rounded-xl outline-none"><input type="text" id="f-zone" value="${r ? r.zone : ''}" placeholder="Khu vực" class="w-full p-3 bg-slate-100 rounded-xl outline-none"><input type="number" id="f-price" value="${r ? r.basePrice : ''}" placeholder="Giá thuê" class="w-full p-3 bg-slate-100 rounded-xl outline-none"><button onclick="${r ? `updateRoomInfo('${id}')` : 'saveRoom()'}" class="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold">LƯU</button></div>`;
    } else if (type === 'move-room') {
        renderMoveRoomForm(id, content);
    } else if (type === 'detail') {
        renderRoomDetail(id, content);
    }
};

window.updateRoomInfo = async (id) => {
    const roomNumber = document.getElementById('f-roomNum').value;
    const zone = document.getElementById('f-zone').value;
    const basePrice = Number(document.getElementById('f-price').value);
    await update(ref(db, `rooms/${id}`), { roomNumber, zone, basePrice });
    closeModal();
};

window.saveRoom = async () => {
    const roomNumber = document.getElementById('f-roomNum').value;
    const zone = document.getElementById('f-zone').value || "Mặc định";
    const basePrice = Number(document.getElementById('f-price').value);
    const newRoomRef = push(ref(db, 'rooms'));
    await set(newRoomRef, {
        roomNumber, zone, basePrice, status: 'empty', 
        lastElectric: 0, lastWater: 0, tenantName: null, booking: null, checkInDate: null
    });
    closeModal();
};

window.updateStatus = async (id, status) => {
    const updates = { status };
    if (status === 'empty') {
        updates.tenantName = null; updates.booking = null; updates.checkInDate = null; updates.previousStatus = null; updates.debtAmount = 0;
    }
    await update(ref(db, `rooms/${id}`), updates);
    closeModal();
};

function renderMoveRoomForm(oldRoomId, container) {
    const oldRoom = rooms.find(r => r.id === oldRoomId);
    const availableRooms = rooms.filter(r => r.status === 'empty');
    container.innerHTML = `<h3 class="text-xl font-black mb-2 text-blue-700 italic">Đổi phòng: P.${oldRoom.roomNumber}</h3><p class="text-[10px] text-slate-400 mb-4 uppercase font-bold italic text-center">Thông tin khách sẽ được giữ nguyên</p><div class="space-y-4"><select id="newRoomId" class="w-full p-3 bg-slate-100 rounded-xl outline-none">${availableRooms.map(r => `<option value="${r.id}">Sang P.${r.roomNumber} (${r.basePrice.toLocaleString()}đ)</option>`).join('')}</select><div class="grid grid-cols-2 gap-2 text-[10px] text-slate-500 font-bold uppercase"><label>Điện phòng MỚI</label><label>Nước phòng MỚI</label></div><div class="grid grid-cols-2 gap-2"><input type="number" id="m-electric" placeholder="Số điện" class="p-3 bg-blue-50 rounded-xl outline-none border border-blue-100"><input type="number" id="m-water" placeholder="Số nước" class="p-3 bg-blue-50 rounded-xl outline-none border border-blue-100"></div><button onclick="confirmMoveRoom('${oldRoomId}')" class="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg">XÁC NHẬN CHUYỂN PHÒNG</button><button onclick="closeModal()" class="w-full py-2 text-slate-400 font-bold text-xs">HỦY BỎ</button></div>`;
}

window.confirmMoveRoom = async (oldRoomId) => {
    const newRoomId = document.getElementById('newRoomId').value;
    const startE = Number(document.getElementById('m-electric').value);
    const startW = Number(document.getElementById('m-water').value);
    if (!newRoomId) return alert("Không còn phòng trống!");
    const oldRoom = rooms.find(r => r.id === oldRoomId);
    await update(ref(db, `rooms/${newRoomId}`), { status: 'occupied', tenantName: oldRoom.tenantName, checkInDate: oldRoom.checkInDate, lastElectric: startE, lastWater: startW });
    await update(ref(db, `rooms/${oldRoomId}`), { status: 'empty', tenantName: null, checkInDate: null, booking: null });
    closeModal();
};

function renderRoomDetail(id, container) {
    const r = rooms.find(room => room.id === id);
    let actionHTML = "";
    if (r.status === 'empty') {
        actionHTML = `<div class="bg-yellow-50 p-4 rounded-2xl border border-yellow-100 space-y-3"><p class="text-xs font-bold text-yellow-600 uppercase italic">Phiếu đặt cọc</p><input type="text" id="b-name" placeholder="Tên khách hàng" class="w-full p-3 rounded-xl border-none shadow-sm"><input type="tel" id="b-phone" placeholder="Số điện thoại" class="w-full p-3 rounded-xl border-none shadow-sm"><div class="grid grid-cols-2 gap-2"><input type="number" id="b-amount" placeholder="Tiền cọc" class="p-3 rounded-xl border-none shadow-sm font-bold text-blue-600"><select id="b-payMethod" class="p-3 rounded-xl border-none shadow-sm text-sm"><option value="Tiền mặt">Tiền mặt</option><option value="Chuyển khoản">Chuyển khoản</option></select></div><textarea id="b-note" placeholder="Ghi chú..." class="w-full p-3 rounded-xl border-none shadow-sm text-sm h-20"></textarea><button onclick="confirmBooking('${id}')" class="w-full py-4 bg-yellow-500 text-white rounded-2xl font-bold">XÁC NHẬN CỌC</button></div>`;
    } else if (r.status === 'deposit') {
        actionHTML = `<div class="bg-blue-50 p-4 rounded-2xl border border-blue-100 space-y-3"><p class="text-xs font-bold text-blue-600 uppercase italic">Chi tiết đặt cọc</p><div class="p-3 bg-white rounded-xl text-xs space-y-2 shadow-sm"><p><b>Khách:</b> ${r.booking.name} - ${r.booking.phone}</p><p><b>Tiền cọc:</b> ${Number(r.booking.amount).toLocaleString()}đ - <b>${r.booking.method || ''}</b></p><div class="bg-slate-50 p-2 rounded-lg border-l-4 border-yellow-400 italic font-medium"><b>Ghi chú:</b> ${r.booking.note || 'Không có ghi chú'}</div></div><div class="grid grid-cols-2 gap-2 italic text-[10px] text-slate-400"><label>Điện BẮT ĐẦU</label><label>Nước BẮT ĐẦU</label></div><div class="grid grid-cols-2 gap-2"><input type="number" id="in-electric" placeholder="Số điện" class="p-3 rounded-xl border-none shadow-sm"><input type="number" id="in-water" placeholder="Số nước" class="p-3 rounded-xl border-none shadow-sm"></div><button onclick="confirmCheckIn('${id}')" class="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold">HOÀN TẤT NHẬN PHÒNG</button></div>`;
    } else if (r.status === 'occupied') {
        actionHTML = `<div class="bg-blue-50 p-4 rounded-2xl border border-blue-100 space-y-3"><div class="flex justify-between items-center"><p class="text-xs font-bold text-blue-600 uppercase italic">Thông tin lưu trú</p><span class="bg-blue-600 text-white text-[10px] px-2 py-1 rounded-full font-bold">${calculateStayDuration(r.checkInDate)}</span></div><div class="p-3 bg-white rounded-xl text-xs space-y-1 shadow-sm"><p><b>Khách:</b> ${r.tenantName}</p><p><b>Ngày bắt đầu:</b> ${r.checkInDate}</p><p><b>Giá thuê:</b> ${r.basePrice.toLocaleString()}đ</p></div><div class="flex gap-2"><button onclick="openModal('move-room', '${id}')" class="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-bold uppercase shadow-sm active:scale-95 transition-transform"><i class="fa fa-exchange-alt mr-1"></i> Đổi phòng</button><button onclick="updateStatus('${id}', 'empty')" class="flex-1 py-3 bg-white text-red-500 border border-red-100 rounded-xl text-[10px] font-bold uppercase">Trả phòng</button></div></div>`;
    } else if (r.status === 'maintenance') {
        actionHTML = `<div class="bg-red-50 p-8 rounded-2xl border border-red-100 text-center space-y-4"><i class="fa fa-tools text-red-300 text-4xl"></i><p class="text-sm font-bold text-red-600 uppercase">Đang bảo trì</p><p class="text-[10px] text-slate-400 italic">Sẽ quay lại: ${r.previousStatus === 'occupied' ? 'Khách ở' : (r.previousStatus === 'deposit' ? 'Đã cọc' : 'Trống')}</p><button onclick="toggleMaintenance('${id}')" class="w-full py-4 bg-white text-blue-600 border border-blue-200 rounded-xl font-bold uppercase shadow-sm">XONG BẢO TRÌ</button></div>`;
    }

    container.innerHTML = `<div class="flex justify-between items-center mb-4"><h3 class="text-2xl font-black italic text-slate-800">P.${r.roomNumber}</h3><div class="flex gap-2"><button onclick="openModal('edit-room', '${id}')" class="w-10 h-10 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center shadow-sm active:scale-90 transition-transform"><i class="fa fa-edit text-sm"></i></button>${r.status !== 'maintenance' ? `<button onclick="toggleMaintenance('${id}')" class="w-10 h-10 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center shadow-sm active:scale-90 transition-transform"><i class="fa fa-tools text-sm"></i></button>` : ''}<button onclick="deleteRoom('${id}')" class="w-10 h-10 bg-red-50 text-red-400 rounded-full flex items-center justify-center shadow-sm active:scale-90 transition-transform"><i class="fa fa-trash text-sm"></i></button></div></div>${actionHTML}<button onclick="closeModal()" class="w-full mt-4 py-2 text-slate-300 font-bold uppercase text-[10px] tracking-widest">Quay lại</button>`;
}

window.confirmBooking = async (id) => {
    const booking = { name: document.getElementById('b-name').value, phone: document.getElementById('b-phone').value, amount: document.getElementById('b-amount').value, method: document.getElementById('b-payMethod').value, note: document.getElementById('b-note').value, date: new Date().toISOString().split('T')[0] };
    if(!booking.name || !booking.amount) return alert("Nhập tên và tiền cọc!");
    await update(ref(db, `rooms/${id}`), { status: 'deposit', booking });
    closeModal();
};
window.deleteRoom = async (id) => {
    if (confirm("Bạn có chắc chắn muốn xoá phòng này không? Dữ liệu không thể khôi phục!")) {
        await remove(ref(db, `rooms/${id}`));
        closeModal();
        alert("Đã xoá phòng thành công!");
    }
};

window.confirmCheckIn = async (id) => {
    const startE = Number(document.getElementById('in-electric').value);
    const startW = Number(document.getElementById('in-water').value);
    const r = rooms.find(room => room.id === id);
    const today = new Date().toISOString().split('T')[0]; 
    await update(ref(db, `rooms/${id}`), { status: 'occupied', lastElectric: startE, lastWater: startW, tenantName: r.booking.name, checkInDate: today, booking: null });
    closeModal();
};

// --- RENDER SƠ ĐỒ (CẬP NHẬT HIỂN THỊ NỢ THÁNG) ---
function renderRooms() {
    const grid = document.getElementById('roomGrid');
    if(!grid) return;
    const zones = [...new Set(rooms.map(r => r.zone))];
    grid.innerHTML = zones.map(z => `
        <div class="col-span-2 mt-4 first:mt-0 italic"><h4 class="text-[10px] font-black uppercase text-slate-400 tracking-widest">${z}</h4></div>
        ${rooms.filter(r => r.zone === z).map(r => {
            const hasDebt = (r.debtAmount > 0);
            return `
            <div onclick="openModal('detail', '${r.id}')" class="p-4 rounded-3xl shadow-sm border-2 transition-all active:scale-95 
                ${hasDebt ? 'bg-red-50 border-red-500' : 
                  r.status === 'occupied' ? 'bg-blue-600 border-blue-600 text-white' : 
                  r.status === 'deposit' ? 'bg-yellow-400 border-yellow-400 text-white' : 
                  r.status === 'maintenance' ? 'bg-red-500 border-red-500 text-white' : 'bg-white border-slate-200'}">
                <div class="text-xl font-black italic text-center">P.${r.roomNumber}</div>
                <div class="text-[10px] font-bold opacity-80 uppercase mt-1 truncate text-center">
                    ${hasDebt ? `<span class="text-red-600">Nợ T${r.debtMonth}: ${r.debtAmount.toLocaleString()}đ</span>` : 
                      (r.status === 'occupied' ? r.tenantName : (r.status === 'deposit' ? 'Đã cọc' : (r.status === 'maintenance' ? 'Bảo trì' : 'Trống')))}
                </div>
            </div>`;
        }).join('')}`).join('');
}

const roomsRef = ref(db, 'rooms');
onValue(roomsRef, (snapshot) => {
    const data = snapshot.val();
    rooms = [];
    if (data) {
        Object.keys(data).forEach(key => { rooms.push({ id: key, ...data[key] }); });
        rooms.sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, {numeric: true}));
    }
    renderRooms();
    if (!document.getElementById('view-finance').classList.contains('hidden')) renderFinance();
});

// Bản đồ Icon cho các loại chi phí phổ biến
const iconMap = {
    electric: 'fa-bolt-lightning text-yellow-500',
    water: 'fa-droplet text-blue-500',
    internet: 'fa-wifi text-indigo-500',
    garbage: 'fa-trash-can text-slate-400',
    parking: 'fa-motorcycle text-red-500',
    management: 'fa-shield-halved text-green-500',
    cleaning: 'fa-broom text-orange-400',
    default: 'fa-circle-dollar-to-slot text-blue-400'
};

// 1. Render danh sách chi phí chuyên nghiệp có Icon
function renderConfigSettings() {
    const container = document.getElementById('configContainer');
    if (!container) return;

    const icons = {
        electric: 'fa-bolt text-yellow-500',
        water: 'fa-droplet text-blue-500',
        internet: 'fa-wifi text-indigo-500',
        garbage: 'fa-trash-can text-slate-400',
        parking: 'fa-motorcycle text-red-500',
        default: 'fa-circle-dollar-to-slot text-blue-400'
    };

    container.innerHTML = Object.keys(config).map(key => {
        const iconClass = icons[key] || icons.default;
        return `
            <div class="bg-white p-3 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center relative group">
                <button onclick="deleteConfig('${key}')" class="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-slate-300 hover:text-red-500">
                    <i class="fa fa-times text-[10px]"></i>
                </button>

                <div class="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center mb-2 shadow-inner">
                    <i class="fa ${iconClass} text-sm"></i>
                </div>

                <div class="text-center w-full">
                    <label class="text-[8px] font-black text-slate-400 uppercase block mb-1 italic truncate px-2">${key}</label>
                    <div class="flex items-center justify-center bg-slate-50 rounded-xl px-2 py-1 mx-1">
                        <input type="number" data-key="${key}" value="${config[key]}" 
                            class="config-input w-full bg-transparent border-none p-0 font-black text-blue-600 text-center focus:ring-0 text-xs">
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// 2. Mở Form thêm mới chuyên nghiệp bằng Modal
window.openConfigModal = () => {
    const modal = document.getElementById('mainModal');
    const content = document.getElementById('modalContent');
    modal.classList.remove('hidden');
    
    content.innerHTML = `
        <div class="text-center mb-6">
            <div class="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center text-2xl mx-auto mb-3 shadow-inner">
                <i class="fa fa-plus-circle"></i>
            </div>
            <h3 class="text-xl font-black text-slate-800 italic uppercase">Thêm chi phí mới</h3>
            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Thiết lập đơn giá dịch vụ</p>
        </div>
        
        <div class="space-y-4">
            <div class="space-y-1">
                <label class="text-[10px] font-black text-slate-400 uppercase ml-2">Tên dịch vụ (Tiếng Việt)</label>
                <input type="text" id="newConfigName" placeholder="Ví dụ: Phí vệ sinh, Tiền cáp..." 
                    class="w-full p-4 bg-slate-100 rounded-2xl border-none font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500">
            </div>
            <div class="space-y-1">
                <label class="text-[10px] font-black text-slate-400 uppercase ml-2">Đơn giá mặc định</label>
                <input type="number" id="newConfigValue" placeholder="0" 
                    class="w-full p-4 bg-slate-100 rounded-2xl border-none font-black text-blue-600 outline-none">
            </div>
            
            <div class="pt-4 flex flex-col gap-2">
                <button onclick="processAddNewConfig()" class="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg uppercase active:scale-95 transition-all">
                    Xác nhận thêm
                </button>
                <button onclick="closeModal()" class="w-full py-2 text-slate-300 font-bold uppercase text-[10px]">Hủy bỏ</button>
            </div>
        </div>
    `;
};

// 3. Xử lý logic thêm mới
window.processAddNewConfig = async () => {
    const name = document.getElementById('newConfigName').value;
    const value = Number(document.getElementById('newConfigValue').value);
    
    if (!name) return alert("Vui lòng nhập tên dịch vụ!");
    
    // Chuyển đổi tên sang key không dấu để lưu database
    const key = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_');
    
    if (config[key]) return alert("Loại phí này đã tồn tại!");
    
    config[key] = value;
    await set(ref(db, 'settings'), config); // Lưu trực tiếp lên Firebase
    
    alert("Đã thêm chi phí mới!");
    closeModal();
    renderConfigSettings();
};

// Tái định nghĩa hàm deleteConfig và saveSettings để đồng bộ
window.deleteConfig = async (key) => {
    if (confirm(`Xóa bỏ hoàn toàn chi phí "${key}"?`)) {
        delete config[key];
        await set(ref(db, 'settings'), config);
        renderConfigSettings();
    }
};

window.saveSettings = async () => {
    const inputs = document.querySelectorAll('.config-input');
    const newConfig = {};
    inputs.forEach(input => {
        const key = input.getAttribute('data-key');
        newConfig[key] = Number(input.value);
    });
    await set(ref(db, 'settings'), newConfig);
    alert("Đã cập nhật đơn giá thành công!");
};

window.finalizeBill = async (roomId, isPaid) => {
    const r = rooms.find(room => room.id === roomId);
    if (!r) return;

    // 1. Lấy dữ liệu cơ bản, số tháng đóng trước và số tiền giảm giá
    const curE = Number(document.getElementById('cur-e').value) || (r.lastElectric || 0);
    const curW = Number(document.getElementById('cur-w').value) || (r.lastWater || 0);
    const month = parseInt(document.getElementById('financeMonth').value);
    const year = parseInt(document.getElementById('financeYear').value);
    
    // Lấy giá trị giảm giá và số tháng thanh toán
    const prepaidMonths = Math.max(1, Number(document.getElementById('prepaidMonths').value) || 1);
    const discount = Number(document.getElementById('discountAmount').value) || 0;

    // 2. Tính tiền điện nước (theo chỉ số tiêu thụ thực tế)
    const electricCost = Math.round((curE - (r.lastElectric || 0)) * (config.electric || 0));
    const waterCost = Math.round((curW - (r.lastWater || 0)) * (config.water || 0));
    
    // 3. Logic tính tiền phòng chuẩn: Tháng đầu lẻ + (Các tháng sau * Giá nguyên)
    const basePrice = Number(r.basePrice) || 0;
    const daysInMonth = new Date(year, month, 0).getDate();
    const startDate = r.checkInDate ? new Date(r.checkInDate) : new Date(year, month - 1, 1);
    
    let firstMonthPrice = basePrice;
    if (startDate.getMonth() + 1 === month && startDate.getFullYear() === year) {
        const stayDays = daysInMonth - startDate.getDate() + 1;
        firstMonthPrice = daysInMonth > 0 ? Math.round((basePrice / daysInMonth) * stayDays) : 0;
    }

    // Tổng tiền phòng = Tiền tháng đầu + (Giá nguyên tháng * (Số tháng - 1))
    const totalRoomPrice = firstMonthPrice + (basePrice * (prepaidMonths - 1));

    // 4. Tính các dịch vụ đi kèm được chọn
    let totalServices = 0;
    document.querySelectorAll('.service-check:checked').forEach(cb => {
        totalServices += Math.round(Number(cb.getAttribute('data-val')) || 0);
    });

    // 5. Tổng cộng cuối cùng: (Phòng + Điện + Nước + Dịch vụ) - Giảm giá
    // Sử dụng Math.max(0, ...) để tránh trường hợp tổng tiền bị âm
    const totalAmount = Math.max(0, Math.round(totalRoomPrice + electricCost + waterCost + totalServices - discount));

    const billData = {
        roomId, 
        roomNumber: r.roomNumber, 
        tenantName: r.tenantName,
        month, 
        year, 
        totalAmount, 
        discount, // Lưu vết số tiền đã giảm giá vào hóa đơn
        prepaidMonths, 
        status: isPaid ? 'paid' : 'unpaid',
        timestamp: Date.now()
    };

    try {
        // Lưu hóa đơn vào Firebase
        await push(ref(db, `bills/${year}/${month}`), billData);
        
        // 6. Tính toán ngày hết hạn đóng tiền tiếp theo dựa trên số tháng đã đóng
        let nextPayDate = new Date(year, month - 1, startDate.getDate());
        nextPayDate.setMonth(nextPayDate.getMonth() + prepaidMonths);

        // Cập nhật dữ liệu phòng: Số điện nước mới và ngày đóng tiền tiếp theo
        await update(ref(db, `rooms/${roomId}`), { 
            lastElectric: curE, 
            lastWater: curW,
            nextPaymentDate: nextPayDate.toISOString().split('T')[0]
        });
        
        // Hiển thị thông báo thành công mượt mà
        showSuccessNotification(r.roomNumber, totalAmount, isPaid);
        renderFinance(); 
    } catch (e) {
        console.error("Lỗi lưu Firebase:", e.message);
    }
};
// Hàm hiển thị danh sách phòng đã chốt
function renderFinalizedList() {
    const month = document.getElementById('financeMonth').value;
    const year = document.getElementById('financeYear').value;
    const container = document.getElementById('finalizedList');

    onValue(ref(db, `bills/${year}/${month}`), (snapshot) => {
        const data = snapshot.val();
        if (!data) {
            container.innerHTML = `<p class="text-center text-slate-300 text-[10px] font-bold py-10 uppercase italic">Chưa có phòng nào được chốt trong tháng này</p>`;
            return;
        }

        container.innerHTML = Object.keys(data).map(key => {
            const b = data[key];
            return `
                <div class="bg-white p-4 rounded-2xl border-l-4 ${b.status === 'paid' ? 'border-green-500' : 'border-red-500'} shadow-sm flex justify-between items-center">
                    <div>
                        <p class="text-xs font-black text-slate-800">Phòng ${b.roomNumber} - ${b.tenantName}</p>
                        <p class="text-[10px] font-bold text-slate-400">${b.totalAmount.toLocaleString()}đ</p>
                    </div>
                    <span class="text-[8px] font-black px-2 py-1 rounded-lg ${b.status === 'paid' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'} uppercase">
                        ${b.status === 'paid' ? 'Đã thu' : 'Chưa thu'}
                    </span>
                </div>
            `;
        }).join('');
    });
};

function showSuccessNotification(roomNumber, amount, isPaid) {
    const notifyDiv = document.createElement('div');
    notifyDiv.className = "fixed top-10 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm animate-bounce";
    notifyDiv.innerHTML = `
        <div class="bg-white p-4 rounded-3xl shadow-2xl border-2 ${isPaid ? 'border-green-500' : 'border-blue-500'} flex items-center gap-4">
            <div class="w-12 h-12 ${isPaid ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'} rounded-2xl flex items-center justify-center text-2xl">
                <i class="fa ${isPaid ? 'fa-check-circle' : 'fa-file-invoice-dollar'}"></i>
            </div>
            <div>
                <p class="text-[10px] font-black text-slate-400 uppercase italic">Thành công</p>
                <p class="text-xs font-bold text-slate-700">Đã chốt sổ P.${roomNumber}</p>
                <p class="text-sm font-black text-blue-600">${Math.round(amount).toLocaleString()}đ</p>
            </div>
        </div>
    `;
    document.body.appendChild(notifyDiv);
    setTimeout(() => notifyDiv.remove(), 3000);
};


// Hàm lấy dữ liệu hóa đơn từ Firebase
function fetchAllBills() {
    const billsRef = ref(db, 'bills');
    onValue(billsRef, (snapshot) => {
        const data = snapshot.val();
        allBills = [];
        if (data) {
            // Duyệt qua Năm -> Tháng -> Hóa đơn
            Object.keys(data).forEach(year => {
                Object.keys(data[year]).forEach(month => {
                    Object.keys(data[year][month]).forEach(id => {
                        allBills.push({ id, ...data[year][month][id] });
                    });
                });
            });
            // Sắp xếp hóa đơn mới nhất lên đầu
            allBills.sort((a, b) => b.timestamp - a.timestamp);
        }
        filterBills();
    });
};

// Hàm đặt bộ lọc nhanh
window.setQuickFilter = (type) => {
    const now = new Date();
    let from = "", to = "";

    if (type === 'thisMonth') {
        from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        to = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    } else if (type === 'lastMonth') {
        from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
        to = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
    }

    document.getElementById('filterFromDate').value = from;
    document.getElementById('filterToDate').value = to;
    filterBills();
};

// Hàm lọc hóa đơn đa năng
window.filterBills = () => {
    const keyword = document.getElementById('searchBill').value.toLowerCase();
    const fromDate = document.getElementById('filterFromDate').value;
    const toDate = document.getElementById('filterToDate').value;
    const container = document.getElementById('tenantList');

    const filtered = allBills.filter(b => {
        const billDate = new Date(b.timestamp).toISOString().split('T')[0];
        
        const matchName = b.tenantName.toLowerCase().includes(keyword) || b.roomNumber.toString().includes(keyword);
        const matchFrom = !fromDate || billDate >= fromDate;
        const matchTo = !toDate || billDate <= toDate;

        return matchName && matchFrom && matchTo;
    });

    if (filtered.length === 0) {
        container.innerHTML = `<p class="text-center text-slate-300 py-10 font-bold uppercase text-[10px] italic">Không tìm thấy hóa đơn</p>`;
        return;
    }

    container.innerHTML = filtered.map(b => `
    <div class="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 space-y-3 animate-in slide-in-from-bottom-2">
        <div class="flex justify-between items-start">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 ${b.status === 'paid' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'} rounded-2xl flex items-center justify-center text-sm shadow-inner">
                    <i class="fa ${b.status === 'paid' ? 'fa-check' : 'fa-clock'}"></i>
                </div>
                <div>
                    <h4 class="font-black text-slate-800 text-[11px] italic uppercase">P.${b.roomNumber} - ${b.tenantName}</h4>
                    <p class="text-[9px] font-bold text-slate-400 uppercase italic">
                        Ngày chốt: ${new Date(b.timestamp).toLocaleDateString('vi-VN')}
                    </p>
                </div>
            </div>
            <div class="text-right">
                <p class="text-sm font-black text-blue-600">${Math.round(b.totalAmount).toLocaleString()}đ</p>
                <span class="text-[7px] font-black px-2 py-1 rounded-lg ${b.status === 'paid' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'} uppercase">
                    ${b.status === 'paid' ? 'Đã thu' : 'Còn nợ'}
                </span>
            </div>
        </div>

        <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-50">
            ${b.status !== 'paid' ? `
                <button onclick="payQuick('${b.year}', '${b.month}', '${b.id}')" class="py-2 bg-green-500 text-white rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2">
                    <i class="fa fa-dollar-sign"></i> Thanh toán
                </button>
            ` : `
                <div class="py-2 bg-slate-50 text-slate-400 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 italic">
                    <i class="fa fa-check-double"></i> Đã hoàn tất
                </div>
            `}
            
        </div>
    </div>
`).join('');
};
// Cập nhật hàm switchTab để kích hoạt lấy dữ liệu
const originalSwitchTab = window.switchTab;
window.switchTab = (tab) => {
    originalSwitchTab(tab);
    if (tab === 'tenants') { // Tên tab nội bộ vẫn giữ là tenants cho đồng bộ code cũ
        fetchAllBills();
    }
};

// Hàm thanh toán nhanh trực tiếp từ tab Hóa đơn
window.payQuick = async (year, month, billId) => {
    if (!confirm("Xác nhận khách đã thanh toán hóa đơn này?")) return;
    try {
        await update(ref(db, `bills/${year}/${month}/${billId}`), { status: 'paid' });
        // Hiển thị thông báo thành công
        showSuccessNotification("Thành công", "Đã cập nhật thanh toán", true);
        filterBills(); // Tải lại danh sách
    } catch (e) {
        alert("Lỗi: " + e.message);
    }
};

window.closeModal = () => document.getElementById('mainModal').classList.add('hidden');