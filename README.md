# FLiCK Photo

TCFLiCK의 브라우저 전용 이미지 편집기. 이미지 파일을 전송하는 API, 외부 스크립트, 원격 폰트, 런타임 의존성이 없습니다.

## 실행

Node.js 20 이상에서 `npm start` 후 http://127.0.0.1:4173 을 엽니다. `npm run check`로 JavaScript 구문을 검사합니다. 안내 페이지 변경 후 `node scripts/docs.mjs`를 실행합니다. 빌드 없이 `dist`를 그대로 배포합니다.

## Cloudflare Pages

- 프로젝트: flick-photo
- 프레임워크: 없음
- 빌드 명령: 없음
- 출력 폴더: dist
- 운영 도메인: photo.tcflick.com

GitHub 저장소를 연결하거나 인증된 Wrangler에서 `wrangler pages deploy dist --project-name flick-photo`로 배포합니다. 도메인은 Pages Custom domains에서 연결하고 DNS·TLS 상태를 확인해야 합니다. 배포 후 운영 주소에서 변환·개별 다운로드·ZIP·모바일 화면을 재검증합니다. 정상 배포 전에는 tcflick.com 서비스 카드를 추가하지 않습니다.

## 처리 규칙

JPG/PNG/WebP만 입력. 파일당 30 MiB, 합계 120 MiB, 최대 20장, 이미지당 최대 40 MP. 출력 각 변 최대 12000px 및 40 MP. 한 장씩 처리하고 결과 Blob을 메모리에 보관합니다. 기기별 메모리 제한으로 더 작은 작업도 실패할 수 있습니다. ZIP은 UTF-8 파일 이름과 CRC32를 사용하는 무압축 ZIP입니다. 결과 파일명에 순번을 붙입니다.

자르기 → 회전 → 회전된 축에서 반전 → 크기 조절 → 인코딩. JPG 투명 영역은 흰색. PNG에는 품질값이 적용되지 않습니다. 브라우저 인코더에 따라 화질·색상·메타데이터가 바뀔 수 있습니다. 애니메이션은 보존하지 않습니다. 크기 감소를 보장하지 않습니다.

## 광고

`.ad-slot`은 광고가 없으면 hidden 상태입니다. 현재 광고 코드를 탑재하지 않았습니다. 실제 AdSense 게시자·슬롯 ID와 승인, 동의 관리가 확보된 뒤 별도로 도입해야 합니다. 광고 도입 시 개인정보 문서와 CSP를 갱신하고 `data-ad-status="unfilled"` 광고를 숨기는 처리를 적용해야 합니다. 허위 ads.txt는 만들지 않습니다.

## 개인정보

이미지와 이름은 DOM·Blob 메모리에만 있습니다. `connect-src 'none'`으로 앱의 네트워크 전송도 제한합니다. 정적 호스트 접속 로그는 호스팅 사업자 정책을 따릅니다. 원본은 수정하지 않습니다.
