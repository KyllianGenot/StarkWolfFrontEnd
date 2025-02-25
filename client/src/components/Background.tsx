// Background.tsx
import React from 'react';

export const BackgroundStars: React.FC = () => (
  <div className="relative w-full h-full min-h-screen overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-b from-[rgba(26,31,53,0)] to-[rgba(37,42,68,0)]" />
    <div className="absolute inset-0">
      <div className="stars-small" style={{ backgroundImage: SMALL_STARS, backgroundSize: '500px 500px', opacity: 0.8 }} />
      <div className="stars-medium" style={{ backgroundImage: MEDIUM_STARS, backgroundSize: '700px 700px', opacity: 0.7 }} />
      <div className="stars-large" style={{ backgroundImage: LARGE_STARS, backgroundSize: '900px 900px', opacity: 0.6 }} />
      <div className="twinkling" style={{ backgroundImage: TWINKLING_STARS, backgroundSize: '700px 700px' }} />
    </div>
    <div className="shooting-stars">
      <div className="shooting-star" />
      <div className="shooting-star-2" />
      <div className="shooting-star-3" />
    </div>
    <style jsx>{`
      .stars-small, .stars-medium, .stars-large, .twinkling {
        position: absolute;
        inset: 0;
        background-repeat: repeat;
      }
      .twinkling {
        animation: twinkle 4s ease-in-out infinite;
      }
      .shooting-stars {
        position: absolute;
        inset: 0;
        overflow: hidden;
      }
      .shooting-star, .shooting-star-2, .shooting-star-3 {
        position: absolute;
        height: 1px;
        background: linear-gradient(90deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.8) 100%);
        opacity: 0;
        transform-origin: left center;
      }
      .shooting-star {
        top: 20%;
        left: 30%;
        width: 80px;
        filter: drop-shadow(0 0 2px #fff);
        animation: shoot1 4s linear infinite;
      }
      .shooting-star-2 {
        top: 10%;
        left: 40%;
        width: 60px;
        filter: drop-shadow(0 0 1px #fff);
        animation: shoot2 6s linear infinite 1s;
      }
      .shooting-star-3 {
        top: 30%;
        left: 20%;
        width: 70px;
        filter: drop-shadow(0 0 2px #fff);
        animation: shoot3 5s linear infinite 2.5s;
      }
      @keyframes twinkle {
        0%, 100% { opacity: 0.2; }
        50% { opacity: 1; }
      }
      @keyframes shoot1 {
        0% { transform: translate(0, 0) rotate(35deg); opacity: 0; }
        2% { opacity: 1; }
        6% { transform: translate(400px, 280px) rotate(35deg); opacity: 0; }
        100% { transform: translate(400px, 280px) rotate(35deg); opacity: 0; }
      }
      @keyframes shoot2 {
        0% { transform: translate(0, 0) rotate(45deg); opacity: 0; }
        2% { opacity: 1; }
        6% { transform: translate(300px, 300px) rotate(45deg); opacity: 0; }
        100% { transform: translate(300px, 300px) rotate(45deg); opacity: 0; }
      }
      @keyframes shoot3 {
        0% { transform: translate(0, 0) rotate(40deg); opacity: 0; }
        2% { opacity: 1; }
        6% { transform: translate(350px, 290px) rotate(40deg); opacity: 0; }
        100% { transform: translate(350px, 290px) rotate(40deg); opacity: 0; }
      }
    `}</style>
  </div>
);

const SMALL_STARS = generateStarField(150, 1);
const MEDIUM_STARS = generateStarField(75, 1.5);
const LARGE_STARS = generateStarField(40, 2);
const TWINKLING_STARS = generateStarField(20, 2);

function generateStarField(count: number, size: number): string {
  return Array.from({ length: count }, () => {
    const x = Math.random() * 100;
    const y = Math.random() * 100;
    const brightness = Math.random() * 0.5 + 0.5;
    return `radial-gradient(${size}px ${size}px at ${x}% ${y}%, rgba(255,255,255,${brightness}), transparent)`;
  }).join(",");
}