# 검증 기록

검증일: 2026-10-31 (Asia/Seoul)

## 통과

- `npm run check`: app.js, zip.js JavaScript 구문 검사.
- JPG·PNG·WebP 입력 3장 동시 선택, 편집 화면 전환, 순차 처리 성공 3/실패 0.
- 세 입력을 JPG·PNG·WebP 각각으로 변환해 결과 미리보기 및 실제 출력 크기 확인.
- 다운로드한 JPEG를 Pillow로 디코딩: 640×400, 투명 영역 (255,255,255).
- 다운로드한 PNG를 Pillow로 디코딩: 640×400, 투명 영역 RGBA (0,0,0,0).
- 400×400 고정 1:1 자르기, 90° 회전, 좌우 반전 후 320×320 WebP 다운로드·디코딩 성공.
- 비율 유지 크기 조절: 640×400 → 320×200, 90° 회전 시 200×320.
- JPEG 품질 1과 100에서 동일한 320×320 출력이 각각 약 1.4 KB / 2.2 KB로 달라짐.
- 원본보다 커진 결과에 ‘증가’ 표시. PNG에서 품질 슬라이더 비활성화.
- ZIP 버튼으로 실제 FLiCK-Photo.zip 다운로드. JPEG 3개 포함, Python zipfile CRC 검사 통과 및 모든 엔트리 이미지 디코딩 성공.
- 개별 다운로드 링크에서 JPG·PNG·WebP 결과 파일 확보.
- 손상 PNG, 미지원 TXT, 31 MiB 파일 거부 안내. 정상 파일은 유지.
- 출력 가로 0: 처리 실패와 유효 범위 안내. 320으로 수정 후 재처리 성공.
- PC 1280px, 태블릿 768px, 모바일 360px, 폴더블 외부 화면에 해당하는 280px 뷰포트 확인. 가로 문서 넘침 없음. 280px 자르기 모달 확인.
- 생성된 HTML의 내부 링크·CSS·JS·아이콘 경로 검사: 누락 0개.
- 브라우저 콘솔 오류 기록 없음.

## 검증 범위

인앱 Chromium 기반 브라우저와 Pillow/zipfile을 사용했습니다. 모바일·폴더블은 뷰포트 검증이며 실제 기기·iOS Safari·Firefox에서의 실기 검증은 수행하지 않았습니다. 자유 드래그 자르기는 구현했으며, 검증에서는 고정 비율과 좌표 입력 흐름을 사용했습니다. 최대 20장/4천만 화소 등 모든 경계 조합과 저메모리 기기를 소진하는 시험은 수행하지 않았습니다.

## 배포 상태

- GitHub: https://github.com/kjh9410065-art/flick-photo (main), 소스 파일 업로드 완료.
- Cloudflare Pages: flick-photo, GitHub main 자동 배포. 프레임워크 없음, 빌드 명령 없음, 출력 dist.
- 운영 주소: https://photo.tcflick.com/ · 대체 주소: https://flick-photo.pages.dev/
- Cloudflare 사용자 설정 도메인 활성 및 SSL 사용됨 확인.
- 운영 주소에서 PNG/WebP 입력 → WebP 변환·품질 82·320×320 영역 맞춤 결과 320×200 확인. 개별 WebP 다운로드 후 파일 확보.
- 최신 ZIP 흐름: 일괄 다운로드 버튼으로 ZIP 생성 → 명시적인 ZIP 파일 저장 링크. 운영 주소에서 JPEG 2개를 ZIP으로 저장하고 zipfile CRC 및 내부 이미지 디코딩 통과.
- 운영 360px 화면의 문서 폭 345px: 가로 넘침 없음.
- 홈, JS, 안내 5페이지, 정책 2페이지, robots.txt, sitemap.xml HTTP 200 확인. 운영 CSP connect-src 'none' 확인.
- 브라우저 캐시에서 이전 코드가 남지 않도록 앱 모듈 URL 버전 적용.
- 운영 검증 후 본사이트 index.html에 여섯 번째 카드 추가 (커밋 12e8be5). 기존 다섯 서비스 카드 HTML을 동일하게 보존하는 검사 통과.
- 실제 iOS·Android 기기, Safari·Firefox 실기 검증은 미수행.
- 광고 배치용 숨김 영역만 준비했습니다. AdSense 승인·슬롯 설정·광고 송출은 완료 상태가 아닙니다.
