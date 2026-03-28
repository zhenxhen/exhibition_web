document.addEventListener("DOMContentLoaded", () => {
    // 1. UI Elements 변수 연결
    const container = document.getElementById("comparison-slider");
    const originalImage = document.getElementById("image-original");
    const canvas = document.getElementById("canvas-pixelated");

    if (!canvas) return; // 캔버스가 존재하지 않는 페이지는 강제 종료

    // 메인 캔버스: 로고 베이스 + 픽셀 박스 통합 렌더링용
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    // 오프스크린 캔버스: B&W 알고리즘 처리용 (매 프레임 재활용 캐싱)
    const tempCanvas = document.createElement("canvas");
    const tCtx = tempCanvas.getContext("2d", { willReadFrequently: true });

    // 오프스크린 캔버스: 다운스케일 추출용 (GC 방지)
    const tmpDownscaleCanvas = document.createElement("canvas");
    const tmpCtx = tmpDownscaleCanvas.getContext("2d", { willReadFrequently: true });

    // Generator 전용 액션 UI (index.html 등에는 존재하지 않을 수 있으므로 방어 변수 사용)
    const btnRandom = document.getElementById("btn-random");
    const btnSave = document.getElementById("btn-save");
    const seedInput = document.getElementById("seed-input");
    const countdownTimer = document.getElementById("countdown-timer");

    // -------------------------------------------------------------
    // 카운트다운 타이머 (목표: 5월 19일 오전 11시)
    // -------------------------------------------------------------
    function updateCountdown() {
        if (!countdownTimer) return;
        // JS Date에서 월(Month)은 0부터 시작하므로 5월은 4를 기입합니다.
        const targetDate = new Date(new Date().getFullYear(), 4, 19, 11, 0, 0);
        const now = new Date();
        let diff = targetDate.getTime() - now.getTime();
        
        if (diff < 0) diff = 0; // 이미 11시가 지났다면 00:00:00 고정
        
        const totalSecs = Math.floor(diff / 1000);
        const hours = Math.floor(totalSecs / 3600);
        const minutes = Math.floor((totalSecs % 3600) / 60);
        const seconds = totalSecs % 60;
        
        // 두 자리 수 패딩
        const pad = num => String(num).padStart(2, '0');
        countdownTimer.textContent = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }

    if (countdownTimer) {
        updateCountdown();
        setInterval(updateCountdown, 1000);
    }
    // -------------------------------------------------------------

    let randomBoxes = [];
    let animationId = null; // 애니메이션 루프 제어 변수
    let logoBounds = null;

    let currentSeedState = seedInput ? (parseInt(seedInput.value, 10) || 123456) : 123456;

    function seededRandom() {
        let x = Math.sin(currentSeedState++) * 10000;
        return x - Math.floor(x);
    }

    function resetSeed(seedVal) {
        currentSeedState = seedVal;
    }

    // 2. 캔버스 초기화
    function setupCanvas() {
        if (!originalImage.complete || originalImage.naturalWidth === 0) {
            originalImage.addEventListener('load', setupCanvas);
            return;
        }

        // --- 로고의 투명한 여백을 무시하고, 실제 잉크(불투명 픽셀)가 있는 공간만 계산 ---
        const tmpC = document.createElement("canvas");
        tmpC.width = originalImage.naturalWidth;
        tmpC.height = originalImage.naturalHeight;
        const tmpCtxScan = tmpC.getContext("2d", { willReadFrequently: true });
        tmpCtxScan.drawImage(originalImage, 0, 0);

        const imgData = tmpCtxScan.getImageData(0, 0, tmpC.width, tmpC.height).data;
        let minX = tmpC.width, minY = tmpC.height, maxX = 0, maxY = 0;

        for (let y = 0; y < tmpC.height; y++) {
            for (let x = 0; x < tmpC.width; x++) {
                const alpha = imgData[(y * tmpC.width + x) * 4 + 3];
                if (alpha > 5) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }

        if (maxX >= minX && maxY >= minY) {
            logoBounds = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
        } else {
            logoBounds = { x: 0, y: 0, w: tmpC.width, h: tmpC.height }; // 기본값
        }

        updateFromSeed();
    }

    // 화면 재계산 트리거
    function updateFromSeed() {
        if (animationId) cancelAnimationFrame(animationId);

        let seedVal;
        if (seedInput) {
            seedVal = parseInt(seedInput.value, 10);
            if (isNaN(seedVal)) {
                seedVal = 123456;
                seedInput.value = seedVal;
            }
        } else {
            // UI 없는 디스플레이 환경 (ex: index.html) 에서는 계속 순수 무작위 발생
            seedVal = Math.floor(Math.random() * 89999999) + 10000000;
        }

        // 시드 리셋 (레이아웃 재생성을 위해 한 번만)
        resetSeed(seedVal);

        generateRandomBoxes();
        
        if (seedInput) {
            // Generator 페이지: 애니메이션 없이 1회성 정지 렌더링
            randomBoxes.forEach(box => {
                box.x = Math.round(box.floatX / box.pixelSize) * box.pixelSize;
            });
            renderPixelatedBoxes();
        } else {
            // index 페이지: 반복 롤링 애니메이션 트리거 실행
            animate(); 
        }
    }

    // 4개의 박스 및 가변 float 기반 속도 설정
    function generateRandomBoxes() {
        randomBoxes = [];

        const maxW = logoBounds ? logoBounds.w : (originalImage.naturalWidth || 800);
        const maxH = logoBounds ? logoBounds.h : (originalImage.naturalHeight || 600);
        const startX = logoBounds ? logoBounds.x : 0;
        const startY = logoBounds ? logoBounds.y : 0;

        // 4개의 픽셀 강도 조합
        const intensities = [8, 12, 16, 24];

        for (let i = 0; i < intensities.length; i++) {
            const pSize = intensities[i];

            const boxW_raw = seededRandom() * (maxW * 0.4) + (maxW * 0.5);
            const boxH_raw = seededRandom() * (maxH * 0.3) + (maxH * 0.2);

            const boxX_raw = startX + seededRandom() * Math.max(0, maxW - boxW_raw);
            const boxY_raw = startY + seededRandom() * Math.max(0, maxH - boxH_raw);

            // X를 제외한 나머지 좌표들은 배수로 철저히 맞춤
            const boxW = Math.max(pSize, Math.round(boxW_raw / pSize) * pSize);
            const boxH = Math.max(pSize, Math.round(boxH_raw / pSize) * pSize);
            const boxY = Math.round(boxY_raw / pSize) * pSize;

            randomBoxes.push({
                floatX: boxX_raw,      // 부드러운 계산을 위한 논리 좌표
                y: boxY,
                w: boxW,
                h: boxH,
                pixelSize: pSize,
                speed: pSize * 0.1,    // 각기 다른 강도(크기)에 비례하는 무빙 스피드
                direction: (i % 2 === 1) ? 1 : -1 // 2번째(i=1)와 4번째(i=3)는 1(좌->우), 나머지는 -1(우->좌)
            });
        }
    }

    // 애니메이션 렌더링 루프 (교차 무빙 이동 / 화면 밖으로 벗어나면 재생성)
    function animate() {
        if (!logoBounds) return;
        const maxW = logoBounds.w;
        const startX = logoBounds.x;

        randomBoxes.forEach(box => {
            // 각각 설정된 고유 방향(1 또는 -1)과 고유 속도에 맞춰 이동
            box.floatX += box.speed * box.direction;

            if (box.direction === -1) {
                // [우측 -> 좌측 흐름] 박스: 완전히 왼쪽으로 사라지면 오른쪽 끝에서 다시 스폰
                if (box.floatX + box.w < startX - 50) {
                    box.floatX = startX + maxW + 50;
                }
            } else {
                // [좌측 -> 우측 흐름] 박스: 완전히 오른쪽으로 사라지면 왼쪽 끝에서 다시 스폰
                if (box.floatX > startX + maxW + 50) {
                    box.floatX = startX - box.w - 50;
                }
            }

            // 시각적으로 그려질 때는 '실제 픽셀 강도(pixelSize)' 단위의 그리드 칸에 맞추어 딱딱 끊기게 표출
            box.x = Math.round(box.floatX / box.pixelSize) * box.pixelSize;
        });

        renderPixelatedBoxes();
        animationId = requestAnimationFrame(animate);
    }

    // 각각의 박스마다 픽셀화 변환을 거쳐 메인 캔버스에 그리는 엔진
    function renderPixelatedBoxes() {
        if (!originalImage.naturalWidth || randomBoxes.length === 0) return;

        canvas.width = originalImage.naturalWidth;
        canvas.height = originalImage.naturalHeight;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 베이스 이미지를 가장 밑에 깜
        ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = false;

        randomBoxes.forEach(box => {
            const actualPixelSize = box.pixelSize;

            const smallW = Math.ceil(canvas.width / actualPixelSize);
            const smallH = Math.ceil(canvas.height / actualPixelSize);

            // 임시 캔버스 크기를 픽셀 배수에 완벽히 맞춤
            tempCanvas.width = smallW * actualPixelSize;
            tempCanvas.height = smallH * actualPixelSize;

            tCtx.imageSmoothingEnabled = false;
            tCtx.mozImageSmoothingEnabled = false;
            tCtx.webkitImageSmoothingEnabled = false;
            tCtx.msImageSmoothingEnabled = false;

            // 다운스케일 렌더링 - 늘어남 방지를 위해 scale 로직 활용
            tmpDownscaleCanvas.width = smallW;
            tmpDownscaleCanvas.height = smallH;
            tmpCtx.imageSmoothingEnabled = false;

            tmpCtx.save();
            tmpCtx.scale(1 / actualPixelSize, 1 / actualPixelSize);
            tmpCtx.drawImage(originalImage, 0, 0);
            tmpCtx.restore();

            // 배수에 맞춰 오차 없이 완벽한 업스케일 렌더링
            tCtx.save();
            tCtx.scale(actualPixelSize, actualPixelSize);
            tCtx.drawImage(tmpDownscaleCanvas, 0, 0);
            tCtx.restore();

            // 박스가 화면 영역 외곽으로 나갔을 경우 getImageData의 범위를 초과하지 않게 자름
            const sX = Math.max(0, box.x);
            const sY = Math.max(0, box.y);
            // x값이 음수거나 화면 범위를 초과한 만큼 width 제한
            const getW = Math.max(0, Math.min(box.w - (sX - box.x), tempCanvas.width - sX));
            const getH = Math.max(0, Math.min(box.h - (sY - box.y), tempCanvas.height - sY));

            if (getW > 0 && getH > 0) {
                const imageData = tCtx.getImageData(sX, sY, getW, getH);
                const data = imageData.data;

                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];

                    if (a < 128) {
                        data[i + 3] = 0;
                    } else {
                        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
                        if (brightness > 127) {
                            // 흰색 영역 투명도
                            data[i] = 255;
                            data[i + 1] = 255;
                            data[i + 2] = 255;
                            data[i + 3] = 0;
                        } else {
                            // 검정색
                            data[i] = 0;
                            data[i + 1] = 0;
                            data[i + 2] = 0;
                            data[i + 3] = 255;
                        }
                    }
                }
                tCtx.putImageData(imageData, sX, sY);

                // 원본 이미지 영역을 잘라내고 구멍을 뚫습니다 (배경 투명화)
                ctx.save();
                ctx.beginPath();
                ctx.rect(box.x, box.y, box.w, box.h);
                ctx.clip();

                // 투명화
                ctx.clearRect(box.x, box.y, box.w, box.h);

                // 덧씌움: 반드시 계산에 보정된 좌표(sX, sY)를 모두 사용해야 화면 밖으로 나갈 때 흰색 잔상 오류가 발생하지 않습니다.
                ctx.drawImage(tempCanvas, sX, sY, getW, getH, sX, sY, getW, getH);
                ctx.restore();
            }
        });
    }

    setupCanvas();

    // =========== 3. 인터랙션 및 리스너 (방어 코드 처리) ===========

    // 이미지 자체를 직접 누르는 방식 (모든 페이지 공통 인터랙션)
    if (container) {
        container.addEventListener("click", () => {
            if (seedInput) {
                const randomSeed = Math.floor(Math.random() * 89999999) + 10000000;
                seedInput.value = randomSeed;
            }
            updateFromSeed();
        });
    }

    // 🎲 [Generator - 랜덤 버튼]
    if (btnRandom) {
        btnRandom.addEventListener("click", () => {
            if (seedInput) {
                const randomSeed = Math.floor(Math.random() * 89999999) + 10000000;
                seedInput.value = randomSeed;
            }
            updateFromSeed();
        });
    }

    // ⌨️ [Generator - 시드 입력]
    if (seedInput) {
        seedInput.addEventListener("input", () => {
            updateFromSeed();
        });
    }

    // 💾 [Generator - 저장]
    if (btnSave) {
        btnSave.addEventListener("click", async () => {
            const currentSeed = seedInput ? seedInput.value : "random";
            const filename = `InterPlay_Seed_${currentSeed}.png`;

            canvas.toBlob(async (blob) => {
                if (!blob) return;

                if (window.showSaveFilePicker) {
                    try {
                        const handle = await window.showSaveFilePicker({
                            suggestedName: filename,
                            types: [{
                                description: 'PNG Image',
                                accept: { 'image/png': ['.png'] },
                            }],
                        });
                        const writable = await handle.createWritable();
                        await writable.write(blob);
                        await writable.close();
                        return;
                    } catch (err) {
                        return;
                    }
                }

                // 구형 브라우저 폴백
                const blobUrl = URL.createObjectURL(blob);
                const downloadLink = document.createElement("a");
                downloadLink.style.display = 'none';
                downloadLink.href = blobUrl;
                downloadLink.download = filename;

                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);

                setTimeout(() => {
                    URL.revokeObjectURL(blobUrl);
                }, 1000);
            }, "image/png");
        });
    }
});
