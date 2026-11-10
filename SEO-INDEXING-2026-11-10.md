# 플릭포토(FLiCK Photo) 한글 검색·색인 신청 안내

기준일: **2026년 11월 10일**, 한국시간. 운영 주소: **https://photo.tcflick.com/**.

## 실제 완료한 사항

- 운영 GitHub `kjh9410065-art/flick-photo` main에 한글 공식 브랜드명 `플릭포토(FLiCK Photo)` 반영.
- 홈페이지 HTML `<title>`, 설명, Open Graph, `lang="ko"`, 사용자에게 보이는 메인 설명에 한글 브랜드 표기.
- 기존 편집 엔진, 사진 파일 처리, 브라우저 보안 정책, 광고 설정은 변경하지 않음.
- 10개 한국어 편집 안내 페이지와 2개 정책 페이지의 제목·설명·내부 링크에 한글명 반영.
- `/robots.txt`에서 전체 크롤링 허용, `/sitemap.xml`에 13개 URL과 최종 변경일 포함.
- [GitHub Actions 검증](https://github.com/kjh9410065-art/flick-photo/actions/runs/42744857664)에서 운영 서버의 `/`, `/robots.txt`, `/sitemap.xml`, `/guides/convert/` 모두 **HTTP 200 및 한글 메타데이터 확인**.
- [TCFLiCK 본사](https://tcflick.com/) 및 [전체 서비스](https://tcflick.com/services) 페이지에 플릭포토의 실제 접속 링크를 추가하고 준비 중 문구를 제거함. 본사 코드 반영과 실제 배포 전파는 별도 단계로 구분.

> HTTP 200·검색엔진 접근 가능은 **색인 완료나 검색 상위노출의 증거가 아닙니다**. 실제 색인 여부는 Google Search Console 및 네이버 서치어드바이저에서 확인해야 합니다.

## 오늘 저녁 소유자가 신청할 순서

### 1. Google Search Console

1. https://search.google.com/search-console/ 에 로그인.
2. 이미 `tcflick.com` 도메인 속성이 소유확인되어 있으면 그 속성이 `photo.tcflick.com` 하위 도메인을 포함하는지 우선 확인. 아니면 `https://photo.tcflick.com/` URL 접두어 속성 추가·소유확인.
3. 왼쪽 **Sitemaps**에 `https://photo.tcflick.com/sitemap.xml` 제출.
4. 상단 **URL 검사**에 `https://photo.tcflick.com/` 입력 → 실시간 URL 테스트 → 문제가 없으면 **색인 생성 요청**.
5. `/guides/convert/`, `/guides/compress/`, `/guides/resize/` 등 주요 안내 URL도 순차 점검. 많은 URL은 반복 수동 요청보다 사이트맵 제출이 적합.

### 2. 네이버 서치어드바이저

1. https://searchadvisor.naver.com/ 에 로그인하여 **웹마스터 도구**로 이동.
2. `https://photo.tcflick.com/` 사이트를 등록하고 소유확인.
3. **요청 → 사이트맵 제출**에서 `https://photo.tcflick.com/sitemap.xml` 제출.
4. **요청 → 웹페이지 수집**에서 먼저 `https://photo.tcflick.com/` 신청. 필요시 자주 이용할 안내 페이지 몇 개 신청.
5. 요청 상태 및 실제 검색 결과를 나중에 확인. 수집 요청이 검색 노출을 보장하지 않음.

## 한글 검색 테스트 키워드

- `플릭포토`
- `플릭포토 이미지 편집`
- `플릭포토 사진 압축`
- `플릭 포토` (띄어쓰기 검색의 동작 확인용)
- `FLiCK Photo 플릭포토`
- `site:photo.tcflick.com` (구글에서 사이트 색인 여부 확인 보조)

검색창에서 검색어를 입력하면 바로 나오는 것은 **검색엔진이 색인한 다음**입니다. 위 설정이 검색결과의 노출 시점을 확정하지 않습니다.

## 운영 링크

- 메인: https://photo.tcflick.com/
- 사이트맵: https://photo.tcflick.com/sitemap.xml
- robots.txt: https://photo.tcflick.com/robots.txt
- 안내 페이지: https://photo.tcflick.com/guides/convert/

실제 검색 실적(GA4 / Search Console / AdSense)은 아직 계정 연결·집계 검증이 필요합니다. 측정하지 않은 조회수·수익·색인 상태를 작성하지 않습니다.
