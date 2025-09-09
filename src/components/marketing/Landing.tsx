import React from "react";
import { Hero } from "./Hero";
import { Features } from "./Features";
import { Steps } from "./Steps";
import { Pricing } from "./Pricing";
import { Testimonials } from "./Testimonials";
import { FAQ } from "./FAQ";
import { Footer } from "./Footer";

export function Landing({ authenticated }: { authenticated: boolean }) {
  return (
    <>
      <Hero authenticated={authenticated} />
      <Features />
      <Steps />
      <Pricing authenticated={authenticated} />
      <Testimonials />
      <FAQ />
      <Footer />
    </>
  );
}
