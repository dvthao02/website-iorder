import type { CSSProperties } from "react";

import { Cathedral, Garland, GiftBasket, Gifts, Hills, Mountains, SantaSleigh, Snowman, Tree } from "./christmas-art";

// Cảnh nền đêm Giáng sinh quanh Nhà thờ Đức Bà lên đèn (bên trái thẻ đăng nhập, cân với trăng bên phải). Toàn bộ là server component (không hydrate); sao và đốm tuyết sinh từ bộ số giả ngẫu nhiên
// cố định nên mỗi lần dựng ra cùng một bầu trời. Các lớp .xmas__layer dịch nhẹ theo chuột (ChristmasStage) theo độ sâu --depth.
// Ba thứ bấm được (data-xmas: santa, snowman, gifts): người tuyết và hộp quà bật lại pointer-events, ông già Noel bay trên thẻ nên được tính theo
// khung (xem ChristmasSanta); ChristmasStage cho chúng "phản ứng" khi bấm.

function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = seeded(1225);
const stars = Array.from({ length: 84 }, () => ({
  left: random() * 100,
  top: random() * 64,
  size: 1 + random() * 2.2,
  duration: 2.2 + random() * 4,
  delay: -random() * 6,
  peak: 0.55 + random() * 0.45,
}));
const flares = Array.from({ length: 8 }, () => ({ left: 6 + random() * 88, top: 4 + random() * 46, delay: -random() * 5, size: 14 + random() * 10 }));
const sparkles = Array.from({ length: 22 }, () => ({ left: 4 + random() * 92, top: 8 + random() * 80, size: 2 + random() * 2.5, duration: 1.8 + random() * 2.6, delay: -random() * 4 }));

const layer = (depth: number): CSSProperties => ({ "--depth": depth } as CSSProperties);

// Giây (trong chu kỳ 30s của xe, bay lộ diện khoảng 1–17s) ông thả giỏ quà: lệch nhau để không rơi cùng lúc, và rơi ở chỗ xe đang ở bên trái/phải thẻ đăng nhập.
const dropTimes = [5, 7, 13];

export function ChristmasScenery() {
  return <div aria-hidden="true" className="xmas__scenery">
    <div className="xmas__sky" />
    <div className="xmas__layer" style={layer(3)}>
      <div className="xmas__aurora xmas__aurora--green" />
      <div className="xmas__aurora xmas__aurora--violet" />
      <div className="xmas__aurora xmas__aurora--teal" />
    </div>
    <div className="xmas__layer" style={layer(5)}>
      {stars.map((star, index) => <i className="xmas__star" key={index} style={{ left: `${star.left.toFixed(2)}%`, top: `${star.top.toFixed(2)}%`, "--size": `${star.size.toFixed(1)}px`, "--duration": `${star.duration.toFixed(2)}s`, "--delay": `${star.delay.toFixed(2)}s`, "--peak": star.peak.toFixed(2) } as CSSProperties} />)}
      {flares.map((flare, index) => <i className="xmas__flare" key={index} style={{ left: `${flare.left.toFixed(1)}%`, top: `${flare.top.toFixed(1)}%`, "--delay": `${flare.delay.toFixed(2)}s`, "--flare": `${flare.size.toFixed(0)}px` } as CSSProperties} />)}
      <i className="xmas__shooting xmas__shooting--a" />
      <i className="xmas__shooting xmas__shooting--b" />
    </div>
    <div className="xmas__layer" style={layer(8)}>
      <div className="xmas__moon" />
      <div className="xmas__cloud xmas__cloud--a" />
      <div className="xmas__cloud xmas__cloud--b" />
    </div>
    <div className="xmas__layer xmas__layer--bottom" style={layer(10)}>
      <Mountains className="xmas__mountains" />
    </div>
    <div className="xmas__layer xmas__layer--bottom" style={layer(15)}>
      <Hills className="xmas__hill xmas__hill--far" variant="far" />
      <Cathedral className="xmas__cathedral" />
    </div>
    <div className="xmas__layer xmas__layer--bottom" style={layer(20)}>
      <Tree className="xmas__tree xmas__tree--small xmas__tree--l2" uid="t-l2" />
      <Tree className="xmas__tree xmas__tree--big xmas__tree--l1" uid="t-l1" />
      <Tree className="xmas__tree xmas__tree--small xmas__tree--r2" uid="t-r2" />
      <Tree className="xmas__tree xmas__tree--mid xmas__tree--r1" uid="t-r1" />
    </div>
    <div className="xmas__layer xmas__layer--bottom" style={layer(26)}>
      <Hills className="xmas__hill xmas__hill--near" variant="near" />
      <div className="xmas__sparkles">
        {sparkles.map((sparkle, index) => <i key={index} style={{ left: `${sparkle.left.toFixed(1)}%`, top: `${sparkle.top.toFixed(1)}%`, "--size": `${sparkle.size.toFixed(1)}px`, "--duration": `${sparkle.duration.toFixed(2)}s`, "--delay": `${sparkle.delay.toFixed(2)}s` } as CSSProperties} />)}
      </div>
      <div className="xmas__poke xmas__snowman" data-xmas="snowman"><Snowman className="xmas__art" uid="snowman" /></div>
      <div className="xmas__poke xmas__gifts" data-xmas="gifts"><Gifts className="xmas__art" /></div>
    </div>
    <Garland />
  </div>;
}

const bannerSlices = 14;

/**
 * Dải băng vải kéo phía sau xe, buộc vào đuôi xe bằng hai sợi dây. Để vải lượn sóng thật (không phải một tấm cứng xoay nguyên khối), dải được cắt thành
 * 14 lát dọc (bannerSlices): mỗi lát là một "cửa sổ" nhìn vào cùng một mặt vải đầy đủ (.xmas__banner-face, chữ vẽ bằng ::before từ data-text nên trang không
 * có chữ thừa), và nhấp nhô lên xuống lệch pha nhau (sóng chạy từ đầu buộc ra đuôi). Đầu buộc đứng yên, đuôi bay nhiều nhất (--amp). Chỉ dùng transform/opacity.
 * Chữ giữ tiếng Anh theo yêu cầu của người dùng.
 */
function ChristmasBanner({ text }: { text: string }) {
  return <span className="xmas__banner" style={{ "--k": bannerSlices } as CSSProperties}>
    {Array.from({ length: bannerSlices }, (_, index) => {
      const fromTie = (bannerSlices - 1 - index) / (bannerSlices - 1);
      return <span className="xmas__banner-slice" key={index} style={{ "--i": index, "--amp": (fromTie ** 1.35).toFixed(3), "--lag": `${(fromTie * 1.5).toFixed(2)}s` } as CSSProperties}>
        <span className="xmas__banner-face" data-text={text} />
      </span>;
    })}
    <svg className="xmas__banner-rope" focusable="false" preserveAspectRatio="none" viewBox="0 0 60 100">
      <path d="M0 10 Q30 20 60 52 M0 92 Q30 74 60 52" fill="none" stroke="#e3c27c" strokeLinecap="round" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
    </svg>
  </span>;
}

/**
 * Ông già Noel và tuần lộc bay sát mép trên màn hình. Là lớp riêng nằm TRÊN dây kim tuyến, chuông, tuyết và cả thẻ đăng nhập (không nằm trong lớp cảnh nền,
 * vì lớp đó ở dưới cùng và bị che hết; màn hình hẹp/zoom to thì thẻ lên sát mép trên và sẽ che mất xe trượt). Vì ở trên thẻ nên ông KHÔNG nhận chuột
 * (kẻo chặn form khi bay ngang qua); ChristmasStage tự tính cú bấm trúng khung ông ("Ho ho ho!").
 */
export function ChristmasSanta() {
  return <div aria-hidden="true" className="xmas__flight">
    <div className="xmas__santa" data-xmas="santa">
      <div className="xmas__santa-glide">
        <div className="xmas__santa-bob">
          <ChristmasBanner text="Merry Christmas" />
          <SantaSleigh className="xmas__santa-art" />
          <span className="xmas__trail">
            {Array.from({ length: 7 }, (_, index) => <i key={index} style={{ "--i": index } as CSSProperties} />)}
          </span>
        </div>
      </div>
      {/* Giỏ quà dù thả từ gầm xe, mỗi giỏ một thời điểm trong chu kỳ bay (--at, giây); rơi tới đồi tuyết thì mờ đi. */}
      {dropTimes.map((at) => <span className="xmas__drop" key={at} style={{ "--at": `${at}s` } as CSSProperties}><GiftBasket /></span>)}
    </div>
  </div>;
}

/** Lời chúc hiện từng chữ rồi cả dòng nhấp nhô nhẹ. Bản đọc cho trình đọc màn hình là văn bản nguyên vẹn (sr-only), bản chữ rời là aria-hidden. */
export function ChristmasGreeting({ text }: { text: string }) {
  const words = text.split(" ");
  const starts = words.map((_, index) => words.slice(0, index).reduce((sum, word) => sum + Array.from(word).length, 0));
  return <p className="xmas__greeting">
    <span className="sr-only">{text}</span>
    <span aria-hidden="true">
      {words.map((word, wordIndex) => <span key={wordIndex}>
        <span className="xmas__word" style={{ "--w": wordIndex } as CSSProperties}>
          {Array.from(word).map((character, index) => <i key={index} style={{ "--c": starts[wordIndex] + index } as CSSProperties}>{character}</i>)}
        </span>
        {wordIndex < words.length - 1 ? " " : null}
      </span>)}
    </span>
  </p>;
}
