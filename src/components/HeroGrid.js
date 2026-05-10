import React from 'react';

const kids = [
  { src: '/img/kid1.jpg', style: 'rounded-full bg-yellow-200 object-cover' }, // smiling boy (first image)
  { src: '/img/kid2.jpg', style: 'rounded-2xl bg-blue-500 object-cover' }, // twin boys (second image)
  { src: '/img/kid3.jpg', style: 'rounded-full bg-purple-300 object-cover' }, // group of kids (third image)
];

export default function HeroGrid() {
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center">
      {/* Dense background shapes: mostly static, a few floating */}
      {/* Floating shapes */}
      <div className="absolute top-2 left-8 w-10 h-10 bg-yellow-100 rounded-full opacity-60 z-0 animate-float-x" />
      <div className="absolute top-16 right-10 w-16 h-8 bg-blue-100 rounded-full opacity-50 z-0 animate-float-y" />
      <div className="absolute top-1/3 left-1/3 w-8 h-8 bg-pink-200 rounded-full opacity-70 z-0 animate-float-x" />
      <div className="absolute top-1/2 right-1/4 w-12 h-12 bg-green-100 rounded-2xl opacity-60 z-0 animate-float-y" />
      {/* Static shapes for density */}
      <div className="absolute top-0 left-1/2 w-16 h-6 bg-yellow-50 rounded-full opacity-40 z-0" />
      <div className="absolute top-24 left-1/5 w-10 h-10 bg-blue-50 rounded-full opacity-40 z-0" />
      <div className="absolute bottom-0 left-1/3 w-20 h-8 bg-pink-100 rounded-2xl opacity-40 z-0" />
      <div className="absolute bottom-10 right-1/4 w-14 h-14 bg-green-50 rounded-full opacity-40 z-0" />
      <div className="absolute top-1/4 right-1/3 w-8 h-16 bg-purple-50 rounded-3xl opacity-40 z-0" />
      {/* Top row */}
      <div className="flex space-x-4 mb-4">
        <img src={kids[0].src} alt="" className={`w-28 h-28 object-cover ${kids[0].style} shadow-2xl border-4 border-white transition-transform duration-200 hover:scale-105`} />
        <div className="flex flex-col items-center justify-center">
          <div className="bg-black text-white rounded-b-full px-8 py-6 text-center mb-2 shadow-md">
            <div className="text-xs">Active Donors</div>
            <div className="text-3xl font-bold">100+ donors</div>
          </div>
          <img src={kids[2].src} alt="" className={`w-24 h-24 object-cover mt-2 ${kids[2].style} shadow-2xl border-4 border-white transition-transform duration-200 hover:scale-105`} />
        </div>
      </div>
      {/* Middle row */}
      <div className="flex space-x-4 mb-4">
        <img src={kids[1].src} alt="" className={`w-36 h-36 object-cover ${kids[1].style} shadow-2xl border-4 border-white transition-transform duration-200 hover:scale-105`} />
        <div className="bg-yellow-300 rounded-tl-full rounded-bl-full w-20 h-20 ml-2" />
      </div>
      {/* Bottom row */}
      <div className="flex items-center space-x-4">
        <div className="bg-green-200 rounded-t-full rounded-br-full px-8 py-6 text-center shadow-md">
          <div className="text-xs">Donations</div>
          <div className="text-3xl font-bold">300+ donations</div>
        </div>
        <div className="bg-red-400 rounded-full w-10 h-10" />
        <div className="bg-white border border-black rounded-full w-8 h-8 flex items-center justify-center">
          <span className="text-xs">*</span>
        </div>
      </div>
    </div>
  );
} 