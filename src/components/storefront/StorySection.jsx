import React from "react";

export default function StorySection() {
  return (
    <section className="story" id="story">
      <div className="story-mark">
        <img src="/logo.png" alt="SALORIYA Logo" className="story-logo" />
      </div>
      <div>
        <p className="eyebrow">A NOTE FROM SALORIYA</p>
        <h2>
          The luxury look.<br />
          <em>Made accessible.</em>
        </h2>
        <p>
          Why keep elegance locked in a locker? At SALORIYA, we specialize in high-polish gold covering jewellery and readymade collections that recreate the regal finish of traditional jewellery without the hefty price tag. From coordinated chain-and-earring sets to statement bracelets and lightweight daily earrings, our readymade pieces let you sparkle every single day.
        </p>
      </div>
    </section>
  );
}
