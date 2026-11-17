// ============================================================
// 层 3：远景星云光晕（原型 6.html L667-672）
// ============================================================
export default function Nebula() {
  return (
    <div className="fixed inset-0 z-[3] pointer-events-none overflow-hidden">
      <div
        id="ambient-left"
        className="absolute top-[12%] left-[18%] w-[38vw] h-[38vw] max-w-[520px] max-h-[520px] rounded-full bg-[#f28c38]/[0.07] blur-[120px] transition-all duration-1000"
      />
      <div
        id="ambient-right"
        className="absolute bottom-[18%] right-[16%] w-[42vw] h-[42vw] max-w-[560px] max-h-[560px] rounded-full bg-[#5da9e9]/[0.09] blur-[130px] transition-all duration-1000"
      />
    </div>
  )
}
