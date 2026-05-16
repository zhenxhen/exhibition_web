document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('id') || '8';

    try {
        const response = await fetch('List/interplay_projects.json');
        const data = await response.json();

        const project = data.projects.find(p => p.submission_id === projectId);

        if (!project) {
            document.getElementById('project-container').innerHTML = '<div class="loading-state"><h2>Project not found</h2><p>The requested project does not exist.</p></div>';
            return;
        }

        const currentIndex = data.projects.findIndex(p => p.submission_id === projectId);
        renderProject(project, data.projects, currentIndex);
    } catch (error) {
        console.error('Error loading project data:', error);
        document.getElementById('project-container').innerHTML = '<div class="loading-state"><h2>Error loading project</h2><p>Please try again later.</p></div>';
    }
});

function renderProject(project, allProjects, currentIndex) {
    const container = document.getElementById('project-container');

    // Determine main media
    let mainMediaHtml = '';
    const finalImages = (project.media?.final_images || []).filter(url => url && url.trim() !== '');
    const btsMedia = (project.media?.behind_the_scenes || []).filter(url => url && url.trim() !== '');
    const artistPhotos = (project.media?.artist_photos || []).filter(url => url && url.trim() !== '');

    let hasMedia = false;
    if (finalImages.length > 0) {
        hasMedia = true;
        const firstMedia = finalImages[0];
        if (firstMedia.toLowerCase().endsWith('.mp4') || firstMedia.toLowerCase().endsWith('.webm') || firstMedia.toLowerCase().endsWith('.mov')) {
            mainMediaHtml = `<video src="${firstMedia}" autoplay loop muted playsinline controls></video>`;
        } else {
            mainMediaHtml = `<img src="${firstMedia}" alt="${project.project_name}">`;
        }
    }

    // Build Gallery (Remaining Media)
    let galleryHtml = '';
    let remainingMedia = finalImages.length > 0
        ? [...finalImages.slice(1), ...btsMedia]
        : [...btsMedia];

    // Filter out duplicates and ALL artist photos just in case
    const uniqueGalleryMedia = [...new Set(remainingMedia)].filter(url => !artistPhotos.includes(url));

    uniqueGalleryMedia.forEach(url => {
        if (url.toLowerCase().endsWith('.mp4') || url.toLowerCase().endsWith('.webm') || url.toLowerCase().endsWith('.mov')) {
            galleryHtml += `<div class="gallery-item"><video src="${url}" autoplay loop muted playsinline></video></div>`;
        } else {
            galleryHtml += `<div class="gallery-item"><img src="${url}" alt="Gallery image" loading="lazy"></div>`;
        }
    });

    let names = project.artists_raw ? project.artists_raw.split(',').map(n => n.trim()) : [];
    let statements = project.artist_statements?.unassigned || [];
    if (!statements || statements.length === 0) {
        if (project.artist_statements?.full_text) {
            statements = [project.artist_statements.full_text];
        } else {
            statements = [];
        }
    }

    let profileCount = Math.max(names.length, artistPhotos.length);
    let artistProfilesHtml = '';

    const getLinksForArtist = (artistName) => {
        if (!project.artist_links || project.artist_links.length === 0) return '';
        let targetLinks = [];
        if (project.artist_links.length > 0 && project.artist_links[0].artist) {
            let artistData = project.artist_links.find(a => a.artist.trim().toLowerCase() === artistName.trim().toLowerCase());
            if (artistData && artistData.links) targetLinks = artistData.links;
        } else {
            targetLinks = project.artist_links;
        }
        if (targetLinks.length === 0) return '';
        let html = targetLinks.map(link => {
            let href = link.url ? link.url.trim() : '';
            if (!href) return '';
            if (href.startsWith('@')) href = 'https://instagram.com/' + href.substring(1);
            else if (!href.startsWith('http')) href = 'https://' + href;
            let label = link.label ? link.label : 'Link';
            return `<div><a href="${href}" target="_blank" style="color: inherit; text-decoration: underline; text-underline-offset: 3px;">${label}</a></div>`;
        }).join('');
        return `<div style="margin-top: 0.2rem; display: flex; flex-direction: column; gap: 0.2rem;">${html}</div>`;
    };

    if (names.length > 1 && artistPhotos.length === 1) {
        let photoUrl = artistPhotos[0];
        artistProfilesHtml += `
            <div class="artist-profile" style="flex-direction: column; gap: 0.5rem; margin-bottom: 1.5rem;">
                <div class="artist-photo" style="flex: none; width: 150px;"><img src="${photoUrl}" alt="Team Photo"></div>
                <div class="artist-info text-content" style="width: 100%;">`;
        for (let i = 0; i < names.length; i++) {
            let name = names[i] || '';
            let linksHtml = getLinksForArtist(name);
            artistProfilesHtml += `<div style="margin-bottom: 1.2rem;">${name ? `<div style="color: inherit; font-weight: inherit;">${name}</div>` : ''}${linksHtml}</div>`;
        }
        artistProfilesHtml += `</div>
            </div>
        `;
    } else if (profileCount <= 1) {
        let name = names[0] || project.artists_raw;
        let stmt = statements[0] || 'No artist statement provided.';
        let photoUrl = artistPhotos.length > 0 ? artistPhotos[0] : null;
        let linksHtml = getLinksForArtist(name);
        artistProfilesHtml = `
            <div class="artist-profile" style="margin-bottom: 1.5rem;">
                ${photoUrl ? `<div class="artist-photo"><img src="${photoUrl}" alt="Artist Photo"></div>` : ''}
                <div class="artist-info text-content"><div style="color: inherit; font-weight: inherit;">${name}</div><div style="margin-top: 0.5rem;">${stmt}</div>${linksHtml}</div>
            </div>
        `;
    } else {
        for (let i = 0; i < profileCount; i++) {
            let name = names[i] || '';
            let photoUrl = artistPhotos[i] ? artistPhotos[i] : null;
            let linksHtml = getLinksForArtist(name);
            artistProfilesHtml += `
                <div class="artist-profile" style="margin-bottom: 1.5rem; flex-direction: row; align-items: flex-start; gap: 2rem;">
                    ${photoUrl ? `<div class="artist-photo"><img src="${photoUrl}" alt="Artist Photo"></div>` : ''}
                    <div class="artist-info text-content">${name ? `<div style="color: inherit; font-weight: inherit;">${name}</div>` : ''}${linksHtml}</div>
                </div>
            `;
        }
    }

    const prevIndex = (currentIndex - 1 + allProjects.length) % allProjects.length;
    const nextIndex = (currentIndex + 1) % allProjects.length;

    container.innerHTML = `
        <div class="split-layout">
            <div class="left-pane${hasMedia ? '' : ' left-pane--no-media'}">
                ${hasMedia
            ? `<div class="main-media">${mainMediaHtml}</div>`
            : `<div id="logo-hero-container">
                    <div id="comparison-slider" style="pointer-events:none;">
                        <canvas id="canvas-pixelated"></canvas>
                    </div>
                    <div class="logo-hero-text">
                        <div class="logo-hero-caption">Come see the works on display at the gallery</div>
                    </div>
                </div>`}
            </div>
            
            <div class="right-pane">
                <div class="project-header">
                    <a href="project.html?id=${allProjects[prevIndex].submission_id}" class="proj-nav-btn" aria-label="Previous project"><i class="fa-solid fa-chevron-left"></i> Prev</a>
                    
                    <div class="header-center-area">
                        <a href="index-launch.html" id="logo-back-link">
                            <img src="Logo/InterPlay_main_crop.png" style="height:28px; width:auto; display:block;">
                        </a>
                        <div id="header-project-title" class="header-title-text">${project.project_name}</div>
                    </div>

                    <a href="project.html?id=${allProjects[nextIndex].submission_id}" class="proj-nav-btn" aria-label="Next project">Next <i class="fa-solid fa-chevron-right"></i></a>
                </div>
                <div class="hero-section">
                    <h1 class="project-title">${project.project_name}<sup style="opacity:0.4; margin-left:6px; font-weight:300; font-size:0.6em; vertical-align: top; position: relative; top: -0.2em;">${project.year}</sup></h1>
                    <div class="project-artists">
                        ${project.artists_raw}
                    </div>
                    ${project.label_technical ? `<div class="project-tech">${project.label_technical}</div>` : ''}
                </div>

                <div class="content-sections">
                    <div class="section-block">
                        ${project.description_long ? `<div class="text-content">${project.description_long}</div>` : ''}
                    </div>
                    
                    <div class="section-block">
                        <h3 class="section-title">About the Artist${project.artists_raw.includes(',') || project.artists_raw.includes('and') ? 's' : ''}</h3>
                        ${artistProfilesHtml}
                    </div>
                </div>

                ${galleryHtml ? `
                    <div class="gallery-section">
                        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 1rem;">
                            <h3 class="section-title" style="margin-bottom: 0;">Behind the Scenes</h3>
                            <div class="scroll-controls" style="display: none; gap: 0.5rem;">
                                <button class="scroll-btn left-btn" aria-label="Scroll left"><i class="fa-solid fa-chevron-left"></i></button>
                                <button class="scroll-btn right-btn" aria-label="Scroll right"><i class="fa-solid fa-chevron-right"></i></button>
                            </div>
                        </div>
                        <div class="gallery-scroll">
                            ${galleryHtml}
                        </div>
                    </div>
                ` : ''}

                <footer class="project-footer">
                    <div class="project-footer-inner">
                        <div class="project-footer-logo">
                            <img src="Logo/InterPlay_main_crop.png" alt="InterPlay">
                        </div>
                        <div class="project-footer-meta">
                            <span>Creative Computing Exhibition</span>
                        </div>
                        <div class="project-footer-links">
                            <a href="https://www.instagram.com/interplay_cci/" target="_blank">Instagram</a>
                            <a href="https://www.eventbrite.co.uk/e/interplay-ual-creative-computing-exhibition-tickets-1988400645858?aff=oddtdtcreator" target="_blank">Eventbrite</a>
                            <a href="https://uk.linkedin.com/in/interplay-cci-a853a1405" target="_blank">LinkedIn</a>
                        </div>
                        <div class="project-footer-copy">&copy; 2026 InterPlay. All rights reserved.</div>
                    </div>
                </footer>
            </div>
        </div>
    `;

    // Dynamic Header Swap Logic (desktop: rightPane scroll, mobile: window scroll)
    const rightPane = document.querySelector('.right-pane');
    const headerLogo = document.getElementById('logo-back-link');
    const headerTitle = document.getElementById('header-project-title');
    const mainTitle = document.querySelector('.hero-section .project-title');

    const checkTitleSwap = () => {
        if (!headerLogo || !headerTitle || !mainTitle) return;
        const titleRect = mainTitle.getBoundingClientRect();
        const threshold = 60;
        if (titleRect.top < threshold) {
            headerLogo.classList.add('hidden');
            headerTitle.classList.add('visible');
        } else {
            headerLogo.classList.remove('hidden');
            headerTitle.classList.remove('visible');
        }
    };

    // Desktop: right pane is the scroll container
    if (rightPane) rightPane.addEventListener('scroll', checkTitleSwap);
    // Mobile: window/body is the scroll container
    window.addEventListener('scroll', checkTitleSwap);



    // Trigger logo animation now that canvas is in the DOM
    document.dispatchEvent(new CustomEvent('logo-init'));



    // Check if gallery overflows to show scroll controls
    const checkOverflow = () => {
        const scrollEl = document.querySelector('.gallery-scroll');
        const controls = document.querySelector('.scroll-controls');
        if (scrollEl && controls) {
            if (scrollEl.scrollWidth > scrollEl.clientWidth) {
                controls.style.display = 'flex';
            } else {
                controls.style.display = 'none';
            }
        }
    };

    setTimeout(checkOverflow, 100);
    window.addEventListener('resize', checkOverflow);

    // Re-check after images load since they determine the width
    const mediaElements = document.querySelectorAll('.gallery-scroll img, .gallery-scroll video');
    if (mediaElements.length > 0) {
        mediaElements.forEach(el => {
            el.addEventListener('load', checkOverflow);
            el.addEventListener('loadeddata', checkOverflow);
        });
    }

    // Scroll buttons + infinite auto-scroll logic
    setTimeout(() => {
        const leftBtn = document.querySelector('.left-btn');
        const rightBtn = document.querySelector('.right-btn');
        const scrollEl = document.querySelector('.gallery-scroll');
        if (!scrollEl) return;

        // Only set up infinite scroll if content actually overflows
        const setupInfiniteScroll = () => {
            if (scrollEl.scrollWidth <= scrollEl.clientWidth) return;

            // Duplicate children for seamless loop
            const originalItems = Array.from(scrollEl.children);
            originalItems.forEach(item => {
                const clone = item.cloneNode(true);
                clone.setAttribute('aria-hidden', 'true');
                scrollEl.appendChild(clone);
            });

            // Measure total width of one set (after cloning, layout has settled)
            requestAnimationFrame(() => {
                const gap = parseFloat(getComputedStyle(scrollEl).gap) || 0;
                const loopWidth = originalItems.reduce((sum, el) => sum + el.offsetWidth + gap, 0);

                let speed = 0.5;
                let isPaused = false;

                const animate = () => {
                    if (!isPaused) {
                        scrollEl.scrollLeft += speed;
                        if (scrollEl.scrollLeft >= loopWidth) {
                            scrollEl.scrollLeft -= loopWidth;
                        }
                    }
                    requestAnimationFrame(animate);
                };
                requestAnimationFrame(animate);

                const scrollAmount = window.innerWidth <= 900 ? 250 : 350;
                if (leftBtn) {
                    leftBtn.addEventListener('click', () => {
                        scrollEl.scrollLeft = Math.max(0, scrollEl.scrollLeft - scrollAmount);
                    });
                }
                if (rightBtn) {
                    rightBtn.addEventListener('click', () => {
                        scrollEl.scrollLeft += scrollAmount;
                        if (scrollEl.scrollLeft >= loopWidth) {
                            scrollEl.scrollLeft -= loopWidth;
                        }
                    });
                }

            }); // end requestAnimationFrame
        }; // end setupInfiniteScroll

        // Wait for images/videos to load before measuring
        const mediaEls = scrollEl.querySelectorAll('img, video');
        if (mediaEls.length === 0) {
            setupInfiniteScroll();
        } else {
            let loaded = 0;
            const onLoad = () => { if (++loaded >= mediaEls.length) setupInfiniteScroll(); };
            mediaEls.forEach(el => {
                if (el.complete || el.readyState >= 2) { onLoad(); }
                else {
                    el.addEventListener('load', onLoad);
                    el.addEventListener('loadeddata', onLoad);
                    el.addEventListener('error', onLoad);
                }
            });
        }

        // Lightbox: click gallery items to open full-size
        const openLightbox = (src, isVideo) => {
            const lb = document.getElementById('gallery-lightbox');
            const lbImg = document.getElementById('lb-img');
            const lbVid = document.getElementById('lb-vid');
            if (isVideo) {
                lbImg.style.display = 'none';
                lbVid.style.display = 'block';
                lbVid.src = src;
                lbVid.play();
            } else {
                lbVid.style.display = 'none';
                lbVid.src = '';
                lbImg.style.display = 'block';
                lbImg.src = src;
            }
            lb.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        };

        const closeLightbox = () => {
            const lb = document.getElementById('gallery-lightbox');
            const lbVid = document.getElementById('lb-vid');
            lbVid.pause();
            lbVid.src = '';
            lb.style.display = 'none';
            document.body.style.overflow = '';
        };

        if (!document.getElementById('gallery-lightbox')) {
            const lbEl = document.createElement('div');
            lbEl.id = 'gallery-lightbox';
            lbEl.style.cssText = 'display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.92);align-items:center;justify-content:center;cursor:zoom-out;';
            lbEl.innerHTML = `<img id="lb-img" style="max-width:90vw;max-height:90vh;object-fit:contain;display:none;" /><video id="lb-vid" autoplay loop muted playsinline controls style="max-width:90vw;max-height:90vh;display:none;"></video><button id="lb-close" style="position:absolute;top:1.5rem;right:2rem;background:none;border:none;color:#fff;font-size:2rem;cursor:pointer;line-height:1;">&times;</button>`;
            document.body.appendChild(lbEl);
            lbEl.addEventListener('click', (e) => { if (e.target === lbEl) closeLightbox(); });
            document.getElementById('lb-close').addEventListener('click', closeLightbox);
            document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });
        }

        scrollEl.addEventListener('click', (e) => {
            const item = e.target.closest('.gallery-item');
            if (!item) return;
            const vid = item.querySelector('video');
            const img = item.querySelector('img');
            if (vid) openLightbox(vid.src, true);
            else if (img) openLightbox(img.src, false);
        });
        scrollEl.style.cursor = 'pointer';
    }, 150);

    // Update document title
    document.title = `${project.project_name} - InterPlay`;
}
