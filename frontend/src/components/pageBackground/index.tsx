import { useEffect, useState } from "react";

type Background = {
    url: string;
    type: "video" | "image";
};

function getSavedBackground(): Background {
    const url = localStorage.getItem("customBgUrl");
    const type = localStorage.getItem("customBgType");

    if (url && (type === "video" || type === "image")) {
        return { url, type };
    }

    return { url: "/video2.mp4", type: "video" };
}

export default function PageBackground() {
    const [background, setBackground] = useState(getSavedBackground);

    useEffect(() => {
        const handleBackgroundChange = (event: Event) => {
            const detail = (event as CustomEvent<Background>).detail;
            if (detail?.url && (detail.type === "video" || detail.type === "image")) {
                setBackground(detail);
            }
        };

        window.addEventListener("launcherBgChanged", handleBackgroundChange);
        return () => window.removeEventListener("launcherBgChanged", handleBackgroundChange);
    }, []);

    return (
        <div className="page-background" aria-hidden="true">
            {background.type === "video" ? (
                <video autoPlay loop muted playsInline preload="auto">
                    <source
                        src={background.url}
                        type={background.url.toLowerCase().endsWith(".webm") ? "video/webm" : "video/mp4"}
                    />
                </video>
            ) : (
                <img src={background.url} alt="" />
            )}
            <div className="page-background__scrim" />
        </div>
    );
}
