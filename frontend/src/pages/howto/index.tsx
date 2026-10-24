import { Link } from '@tanstack/react-router';
import { ArrowRight, AudioLines, BookOpen, FolderCog, Gamepad2, HardDrive, ShieldCheck, Sparkles, Wrench } from 'lucide-react';

const guideSteps = [
    { number: '01', icon: FolderCog, title: 'Connect your game', body: 'Open Language from the sidebar, then choose the main Zenless Zone Zero Beta folder. Sunbringer detects the game data folder for you.', tag: 'ONE-TIME SETUP' },
    { number: '02', icon: AudioLines, title: 'Choose a voice pack', body: 'Pick a voice language that is already installed in the game. Text and interface language remain controlled by the game client.', tag: 'VOICE SETTINGS' },
    { number: '03', icon: Gamepad2, title: 'Launch into the game', body: 'Return Home and use the main action. Sunbringer checks the selected game location and prepares the configured launcher services.', tag: 'READY TO PLAY' },
];

export default function HowToPage() {
    return (
        <main className="tool-page tool-page--guide sun-guide">
            <div className="tool-page__content sun-guide__content">
                <header className="sun-guide__hero">
                    <div className="sun-guide__hero-mark"><BookOpen size={24} /></div>
                    <div>
                        <span className="sun-guide__eyebrow"><Sparkles size={13} /> FIELD MANUAL / NAP BETA</span>
                        <h1>Start here.</h1>
                        <p>A quick route from setup to your next session.</p>
                    </div>
                    <div className="sun-guide__hero-index"><span>GUIDE</span><strong>01—03</strong></div>
                </header>
                <section className="sun-guide__route" aria-label="Setup guide">
                    <div className="sun-guide__route-line" aria-hidden="true"><span /><i /><span /><i /><span /></div>
                    <div className="sun-guide__steps">
                        {guideSteps.map(({ number, icon: Icon, title, body, tag }) => (
                            <article className="sun-guide__step" key={number}>
                                <div className="sun-guide__step-top"><span>{number}</span><Icon size={20} /></div>
                                <span className="sun-guide__step-tag">{tag}</span><h2>{title}</h2><p>{body}</p>
                            </article>
                        ))}
                    </div>
                </section>
                <section className="sun-guide__lower">
                    <div className="sun-guide__note">
                        <span className="sun-guide__note-icon"><ShieldCheck size={19} /></span>
                        <div><span className="sun-guide__eyebrow">BEFORE YOU PATCH</span><h2>Keep your install safe.</h2><p>Close the game before changing files. Use a patch that matches the installed game version and keep a backup of important data.</p></div>
                    </div>
                    <div className="sun-guide__tools">
                        <span className="sun-guide__eyebrow">QUICK ACCESS</span>
                        <Link to="/language"><AudioLines size={17} /><span><strong>Voice setup</strong><small>Choose an installed voice pack</small></span><ArrowRight size={16} /></Link>
                        <Link to="/diff"><Wrench size={17} /><span><strong>Patch utility</strong><small>Apply a compatible archive</small></span><ArrowRight size={16} /></Link>
                        <div className="sun-guide__storage"><HardDrive size={15} /> Game files stay in your selected install folder.</div>
                    </div>
                </section>
            </div>
        </main>
    );
}
