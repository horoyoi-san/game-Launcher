import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight, Code2, Github, Gamepad2, Heart, MessageCircle, Music2, Sparkles, Youtube } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="tool-page tool-page--about">
      <main className="tool-page__content about-layout">
        <section className="about-hero">
          <div className="about-hero__profile">
            <div className="about-hero__logo-wrap">
              <img src="/appicon.png" alt="Cyrene Launcher logo" />
              <span><Sparkles size={15} /></span>
            </div>
            <div className="about-hero__identity">
              <span className="eyebrow">INDEPENDENT DEVELOPER</span>
              <h1>Horoyoi-san</h1>
              <p>Building useful tools for better game experiences.</p>
            </div>
            <div className="about-hero__divider" />
            <div className="about-hero__signature">
              <Heart size={15} />
              <span>Made with care for the community</span>
            </div>
          </div>

          <div className="about-hero__story">
            <span className="about-kicker"><span /> ABOUT THE PROJECT</span>
            <h2>A calmer way to<br /><em>start playing.</em></h2>
            <p>
              Cyrene Launcher is a lightweight companion for launching and managing
              your game. It brings the everyday tools together in one place, so you
              can spend less time setting things up and more time in-game.
            </p>
            <div className="about-hero__actions">
              <Link to="/" className="about-home-link">
                <ArrowLeft size={16} />
                Back to Home
              </Link>
              <a href="https://github.com/horoyoi-san/game-Launcher" target="_blank" rel="noopener noreferrer" className="about-source-link">
                View project <ArrowUpRight size={15} />
              </a>
            </div>
          </div>
        </section>

        <section className="about-details">
          <div className="about-details__intro">
            <span className="eyebrow">DESIGNED TO BE SIMPLE</span>
            <h2>Everything you need.<br />Nothing in the way.</h2>
          </div>
          <p>
            From launching the game to adjusting language settings and applying
            updates, Cyrene keeps the essential tools close at hand in a clean,
            focused interface.
          </p>
          <div className="about-tech">
            <span className="about-tech__icon"><Gamepad2 size={18} /></span>
            <span><small>BUILT WITH</small><strong>Go + Wails 3</strong></span>
          </div>
          <div className="about-tech">
            <span className="about-tech__icon"><Code2 size={18} /></span>
            <span><small>INTERFACE</small><strong>React + Tailwind</strong></span>
          </div>
        </section>

        <footer className="about-footer">
          <span className="eyebrow">FIND ME AROUND THE WEB</span>
          <nav className="about-socials" aria-label="Developer social links">
            <a href="https://www.youtube.com/@hroyoi-san" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
              <Youtube size={18} /><span>YouTube</span><ArrowUpRight size={13} />
            </a>
            <a href="https://www.tiktok.com/@horoyoi.san2" target="_blank" rel="noopener noreferrer" aria-label="TikTok">
              <Music2 size={18} /><span>TikTok</span><ArrowUpRight size={13} />
            </a>
            <a href="https://discord.gg/gwCwxTB9Du" target="_blank" rel="noopener noreferrer" aria-label="Discord">
              <MessageCircle size={18} /><span>Discord</span><ArrowUpRight size={13} />
            </a>
            <a href="https://github.com/horoyoi-san" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
              <Github size={18} /><span>GitHub</span><ArrowUpRight size={13} />
            </a>
          </nav>
          <span className="about-footer__credit">CYRENE LAUNCHER <span>·</span> BY HOROYOI-SAN</span>
        </footer>
      </main>
    </div>
  );
}
