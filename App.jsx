import { useState, useRef, useEffect, useLayoutEffect } from "react";
import axios from "axios";
import gsap from "gsap";

const TITLE = "Convert any image into PDF";

const prefersReducedMotion = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const getMessage = (count, done) => {
    if (done) return "🎉 Your PDF is ready!";
    if (count === 0) return "Drop in your images to get started";
    if (count === 1) return "Great pick! Add more or convert now";
    if (count < 5) return `Looking good, ${count} images ready`;
    return `Wow, ${count} images! You're on a roll 🔥`;
};

function App() {
    // each image: { id, file, url }  (url is created once, not on every render)
    const [images, setImages] = useState([]);
    const [converting, setConverting] = useState(false);
    const [done, setDone] = useState(false);

    const rootRef = useRef(null);
    const titleRef = useRef(null);
    const inputRef = useRef(null);
    const gridRef = useRef(null);
    const msgRef = useRef(null);
    const btnWrapRef = useRef(null);
    const btnRef = useRef(null);
    const confettiRef = useRef(null);
    const pulseRef = useRef(null);
    const idCounter = useRef(0);
    const imagesRef = useRef([]);

    imagesRef.current = images;

    /* ---------- 1. Page-load entrance (one orchestrated moment) ---------- */
    useLayoutEffect(() => {
        const ctx = gsap.context(() => {
            if (prefersReducedMotion()) return;

            const tl = gsap.timeline({ defaults: { ease: "back.out(1.7)" } });

            tl.from(".title-char", {
                y: 60,
                opacity: 0,
                rotation: () => gsap.utils.random(-15, 15),
                duration: 0.7,
                stagger: 0.025,
            })
                .from(inputRef.current, { scale: 0.6, opacity: 0, duration: 0.7 }, "-=0.3")
                .from(msgRef.current, { y: 20, opacity: 0, duration: 0.5 }, "-=0.3")
                .from(btnWrapRef.current, { y: 40, opacity: 0, duration: 0.6 }, "-=0.3");

            // Floating background blobs
            gsap.utils.toArray(".blob").forEach((blob) => {
                gsap.to(blob, {
                    x: gsap.utils.random(-80, 80),
                    y: gsap.utils.random(-80, 80),
                    duration: gsap.utils.random(4, 7),
                    repeat: -1,
                    yoyo: true,
                    ease: "sine.inOut",
                });
            });

            // Idle dropzone "breathing" so users know where to click
            gsap.to(inputRef.current, {
                borderColor: "#c084fc",
                duration: 1.2,
                repeat: -1,
                yoyo: true,
                ease: "sine.inOut",
            });
        }, rootRef);

        return () => ctx.revert();
    }, []);

    /* ---------- 2. Pop-in animation for newly added previews ---------- */
    useLayoutEffect(() => {
        if (prefersReducedMotion() || !gridRef.current) return;

        const fresh = gridRef.current.querySelectorAll("[data-item]:not([data-animated])");
        if (!fresh.length) return;

        fresh.forEach((el) => el.setAttribute("data-animated", "true"));

        gsap.from(fresh, {
            scale: 0,
            rotation: () => gsap.utils.random(-25, 25),
            opacity: 0,
            duration: 0.6,
            ease: "back.out(2)",
            stagger: 0.08,
        });
    }, [images]);

    /* ---------- 3. Encouraging message bounces when count changes ---------- */
    useEffect(() => {
        if (prefersReducedMotion() || !msgRef.current) return;
        gsap.fromTo(
            msgRef.current,
            { y: 12, opacity: 0, scale: 0.9 },
            { y: 0, opacity: 1, scale: 1, duration: 0.45, ease: "back.out(2)" }
        );
    }, [images.length, done]);

    /* ---------- 4. Convert button pulses when it's ready to be clicked ---------- */
    useEffect(() => {
        pulseRef.current?.kill();
        gsap.set(btnWrapRef.current, { scale: 1 });

        if (images.length > 0 && !prefersReducedMotion()) {
            pulseRef.current = gsap.to(btnWrapRef.current, {
                scale: converting ? 1.08 : 1.04,
                duration: converting ? 0.35 : 0.8,
                repeat: -1,
                yoyo: true,
                ease: "sine.inOut",
            });
        }

        return () => pulseRef.current?.kill();
    }, [images.length, converting]);

    /* ---------- Clean up object URLs on unmount ---------- */
    useEffect(() => {
        return () => imagesRef.current.forEach((img) => URL.revokeObjectURL(img.url));
    }, []);

    /* ---------- Confetti ---------- */
    const launchConfetti = () => {
        if (prefersReducedMotion() || !confettiRef.current || !btnRef.current) return;

        const container = confettiRef.current;
        const rect = btnRef.current.getBoundingClientRect();
        const originX = rect.left + rect.width / 2;
        const originY = rect.top + rect.height / 2;
        const colors = ["#a855f7", "#f472b6", "#facc15", "#34d399", "#60a5fa", "#fb923c"];

        for (let i = 0; i < 40; i++) {
            const piece = document.createElement("div");
            piece.style.cssText = `
                position:absolute; left:${originX}px; top:${originY}px;
                width:${gsap.utils.random(6, 12)}px; height:${gsap.utils.random(6, 12)}px;
                background:${gsap.utils.random(colors)};
                border-radius:${Math.random() > 0.5 ? "50%" : "2px"};
            `;
            container.appendChild(piece);

            gsap.to(piece, {
                x: gsap.utils.random(-300, 300),
                y: gsap.utils.random(-350, -50),
                rotation: gsap.utils.random(-540, 540),
                duration: gsap.utils.random(0.8, 1.4),
                ease: "power2.out",
            });
            gsap.to(piece, {
                y: "+=500",
                opacity: 0,
                duration: 1,
                delay: 0.8,
                ease: "power1.in",
                onComplete: () => piece.remove(),
            });
        }
    };

    /* ---------- Handlers ---------- */
    const handleUpload = (e) => {
        const files = Array.from(e.target.files);
        const mapped = files.map((file) => ({
            id: idCounter.current++,
            file,
            url: URL.createObjectURL(file),
        }));

        images.forEach((img) => URL.revokeObjectURL(img.url));
        setDone(false);
        setImages(mapped);
    };

    const removeImage = (id) => {
        const finish = () => {
            const target = imagesRef.current.find((img) => img.id === id);
            if (target) URL.revokeObjectURL(target.url);
            setImages((prev) => prev.filter((img) => img.id !== id));
        };

        const el = gridRef.current?.querySelector(`[data-id="${id}"]`);

        if (el && !prefersReducedMotion()) {
            gsap.to(el, {
                scale: 0,
                rotation: -30,
                opacity: 0,
                duration: 0.3,
                ease: "back.in(2)",
                onComplete: finish,
            });
        } else {
            finish();
        }
    };

    const convertPDF = async () => {
        setConverting(true);
        setDone(false);

        const formData = new FormData();
        images.forEach((img) => formData.append("images", img.file));

        try {
            const res = await axios.post(
                "http://localhost:4000/api/user/convert",
                formData,
                { responseType: "blob" }
            );

            const url = URL.createObjectURL(res.data);
            const link = document.createElement("a");
            link.href = url;
            link.download = "converted.pdf";
            link.click();
            URL.revokeObjectURL(url);

            setDone(true);
            launchConfetti();
        } catch (error) {
            console.log(error);
            alert("Conversion failed");

            // Gentle shake so the failure is noticeable
            if (!prefersReducedMotion()) {
                gsap.fromTo(
                    btnRef.current,
                    { x: -10 },
                    { x: 0, duration: 0.6, ease: "elastic.out(1, 0.3)" }
                );
            }
        } finally {
            setConverting(false);
        }
    };

    /* ---------- Hover / press feedback ---------- */
    const btnEnter = () => {
        if (images.length === 0 || prefersReducedMotion()) return;
        gsap.to(btnRef.current, { scale: 1.08, duration: 0.25, ease: "power2.out" });
    };
    const btnLeave = () => {
        gsap.to(btnRef.current, { scale: 1, duration: 0.25, ease: "power2.out" });
    };
    const btnDown = () => {
        if (images.length === 0 || prefersReducedMotion()) return;
        gsap.to(btnRef.current, { scale: 0.93, duration: 0.1 });
    };
    const btnUp = () => {
        gsap.to(btnRef.current, { scale: 1.08, duration: 0.4, ease: "elastic.out(1, 0.4)" });
    };

    const dropEnter = () => {
        if (prefersReducedMotion()) return;
        gsap.to(inputRef.current, { scale: 1.06, duration: 0.25, ease: "back.out(2)" });
    };
    const dropLeave = () => {
        gsap.to(inputRef.current, { scale: 1, duration: 0.25 });
    };

    /* Split the title into words > characters so each letter can animate */
    const titleWords = TITLE.split(" ");

    return (
        <div
            ref={rootRef}
            className="relative overflow-hidden p-10 pt-30 text-center bg-radial-[at_25%_25%] from-white to-zinc-900 to-75% min-h-screen"
        >
            {/* Floating background blobs */}
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                <div className="blob absolute top-1/4 left-1/5 w-56 h-56 rounded-full bg-purple-500/30 blur-3xl" />
                <div className="blob absolute top-1/2 right-1/5 w-64 h-64 rounded-full bg-pink-500/25 blur-3xl" />
                <div className="blob absolute bottom-10 left-1/3 w-48 h-48 rounded-full bg-blue-500/25 blur-3xl" />
            </div>

            {/* Confetti layer */}
            <div
                ref={confettiRef}
                className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
                aria-hidden="true"
            />

            <div className="relative">
                <h1
                    ref={titleRef}
                    aria-label={TITLE}
                    className="text-xl text-shadow-lg/30 md:text-5xl font-bold mb-5"
                >
                    {titleWords.map((word, wi) => (
                        <span key={wi} aria-hidden="true">
                            <span className="inline-block whitespace-nowrap">
                                {word.split("").map((char, ci) => (
                                    <span key={ci} className="title-char inline-block">
                                        {char}
                                    </span>
                                ))}
                            </span>
                            {wi < titleWords.length - 1 && " "}
                        </span>
                    ))}
                </h1>

                <input
                    ref={inputRef}
                    type="file"
                    accept="image/png"
                    multiple
                    onChange={handleUpload}
                    onDragEnter={dropEnter}
                    onDragLeave={dropLeave}
                    onDrop={dropLeave}
                    className="p-4 text-white md:p-10 w-60 md:w-120 mt-12 border-3 border-dashed rounded-2xl"
                />

                <div className="mt-6">
                    <span
                        ref={msgRef}
                        aria-live="polite"
                        className="inline-block bg-black/40 text-white text-sm md:text-lg px-4 py-1 rounded-full"
                    >
                        {getMessage(images.length, done)}
                    </span>
                </div>

                <div ref={gridRef} className="flex flex-wrap justify-center gap-5 mt-8">
                    {images.map((image) => (
                        <div key={image.id} data-item data-id={image.id}>
                            <img
                                src={image.url}
                                className="w-32 h-32 object-cover rounded-lg shadow-lg"
                                alt="Preview"
                            />

                            <button
                                onClick={() => removeImage(image.id)}
                                className="bg-red-500 text-white px-3 py-1 mt-2 rounded"
                            >
                                Remove
                            </button>
                        </div>
                    ))}
                </div>

                {/* Wrapper handles the pulse, button handles hover/press, so they never fight */}
                <div ref={btnWrapRef} className="inline-block mt-8">
                    <button
                        ref={btnRef}
                        onClick={convertPDF}
                        onMouseEnter={btnEnter}
                        onMouseLeave={btnLeave}
                        onMouseDown={btnDown}
                        onMouseUp={btnUp}
                        disabled={images.length === 0 || converting}
                        className="bg-purple-800 shadow-xl/30 text-shadow-lg/30 font-medium text-xl md:text-3xl cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 text-white px-6 md:px-10 py-3 md:py-5 rounded-2xl"
                    >
                        {converting ? "Converting..." : "Convert to PDF"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default App;
