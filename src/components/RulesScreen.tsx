import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { CLASS_META, CLASS_ORDER } from '../data/dragons';
import { ClassIcon } from './ClassIcon';
import { soundFX } from '../utils/sound';

interface Props {
  onBack: () => void;
}

export const RulesScreen: React.FC<Props> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-[#0B0E14] text-slate-100 flex flex-col">
      <header className="w-full max-w-5xl mx-auto px-6 py-4 flex items-center gap-4 border-b border-white/10">
        <button
          onClick={() => {
            soundFX.playClick();
            onBack();
          }}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-[#131822] hover:bg-[#1C2333] border border-white/10 rounded-lg text-slate-200 cursor-pointer"
        >
          <ArrowLeft size={16} />
          Quay lại
        </button>
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Luật Chơi Dragon Chaos</h1>
          <p className="text-xs text-slate-400">
            Hướng dẫn chia đội 10v10, cơ chế mở rộng chiến trường và điều kiện chiến thắng
          </p>
        </div>
      </header>

      <main className="w-full max-w-5xl mx-auto px-6 py-8 space-y-8">
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="p-5 rounded-xl bg-[#131822] border border-white/10 space-y-2">
            <div className="font-mono-stats text-xs text-amber-400 font-bold">01. CHIA ĐỘI 10 VS 10</div>
            <h2 className="font-semibold text-base text-white">Tuyển chọn không trùng lặp</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Từ bộ sưu tập 20 rồng, bạn lần lượt chọn 10 rồng cho đội mình. AI nhận 10 rồng còn lại.
              Sau đó bạn chọn 5 rồng xuất trận đầu tiên, 5 rồng còn lại nằm trong hàng dự bị.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-[#131822] border border-white/10 space-y-2">
            <div className="font-mono-stats text-xs text-amber-400 font-bold">02. MỞ RỘNG 5V5 → 10V10</div>
            <h2 className="font-semibold text-base text-white">Chiến trường hai giai đoạn</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Trận đấu bắt đầu với 5v5. Khi đạt điều kiện mở rộng (mặc định 45 giây hoặc một bên mất 3 rồng,
              có thể chỉnh trong Settings), 5 rồng dự bị mỗi phe sẽ được triển khai vào trận chiến 10v10.
            </p>
          </div>

          <div className="p-5 rounded-xl bg-[#131822] border border-white/10 space-y-2">
            <div className="font-mono-stats text-xs text-amber-400 font-bold">03. ĐIỀU KIỆN CHIẾN THẮNG</div>
            <h2 className="font-semibold text-base text-white">Tiêu diệt hoặc Tổng HP</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Tiêu diệt toàn bộ 10 rồng đối thủ để thắng ngay. Nếu hết 180 giây mà cả hai bên vẫn còn rồng,
              bên có tổng HP còn lại cao hơn giành chiến thắng (bằng nhau tính Hòa).
            </p>
          </div>
        </section>

        <section className="p-6 rounded-xl bg-[#131822] border border-white/10 space-y-4">
          <h2 className="font-display text-xl font-bold text-white">5 Tộc Hệ Rồng</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {CLASS_ORDER.map((cls) => (
              <div key={cls} className="p-3.5 rounded-lg bg-[#0B0E14] border border-white/10 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-sm text-white">
                  <ClassIcon dragonClass={cls} size={16} />
                  <span>{CLASS_META[cls].label}</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {CLASS_META[cls].description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="p-6 rounded-xl bg-[#131822] border border-white/10 space-y-3">
          <h2 className="font-display text-xl font-bold text-white">Điều Khiển & Chiến Thuật</h2>
          <ul className="text-sm text-slate-300 space-y-2 list-disc list-inside">
            <li>Các rồng tự động di chuyển và chiến đấu theo hành vi AI của từng tộc hệ.</li>
            <li>Nhấp vào bất kỳ rồng nào trên chiến trường để xem chỉ số thực và kích hoạt Kỹ năng 1, Kỹ năng 2 hoặc Tuyệt kỹ thủ công (hoặc bật Auto Kỹ Năng).</li>
            <li>Bạn có thể chỉ định mục tiêu ưu tiên cho rồng đang chọn (kẻ địch cần tập trung hạ gục hoặc đồng minh cần hỗ trợ hồi máu).</li>
            <li><strong>Ngọc Long Hồn:</strong> Khởi đầu trận với 5 Ngọc (nhận thêm +1 Ngọc mỗi 12s, +2 Ngọc khi hạ rồng địch, +3 Ngọc khi mở rộng 10v10). Dùng Ngọc để khảm cường hóa Công, Thủ + Khiên, Tốc độ + Hồi chiêu, Máu tối đa hoặc Nạp đầy &amp; cường hóa Tuyệt kỹ cho rồng phe bạn.</li>
            <li>Chế độ Battle Test Mode cho phép thử nghiệm đội hình 5v5/10v10 và chạy mô phỏng nhanh 100 trận để kiểm tra cân bằng.</li>
          </ul>
        </section>
      </main>
    </div>
  );
};
