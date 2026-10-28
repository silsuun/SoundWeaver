# 소리직녀 아카이브

<소리직녀(SoundWeaver),2026> 제작 아카이빙 사이트.

## 파일 구성

| 파일·폴더 | 하는 일 | 수정가능여부|
|---|---|---|
| `content.js` | 사이트의 모든 글, 사진·소리 목록 | 내용..수정가능 |
| `media/` | 사진·소리·영상 파일을 넣는 곳 | 파일을 올리고 지웁니다 |
| `index.html` | 페이지 뼈대, 보안 설정 | 공유 미리보기 주소(og:image)만 |
| `app.js` | 화면을 그리는 코드 | 고치지 않기. |
| `style.css` | 색과 글꼴 | 색만 바꾸고 싶을 때 맨 위 값 |
| `_headers` | 다른 호스팅으로 옮길 때 쓰는 보안 설정 | 고치지 않기. |

## media 폴더

| 폴더 | 내용 |
|---|---|
| `media/jeongseon` | 정선삼베 사진·소리 |
| `media/hamchang` | 함창명주 사진·소리 |
| `media/hansan` | 한산모시 사진·소리 |
| `media/weaving` | 전통 길쌈 방식 사진 |
| `media/process` | 제작 과정 사진·소리·영상 |
| `media/system` | 사운드 시스템 사진·소리·영상 |
| `media/common` | 공유 미리보기 사진(share.jpg) |

## 사진 넣는 방법 (요약)

1. 사진 파일 이름을 영어 소문자·숫자·하이픈으로 바꿉니다. 예) `beteul-01.jpg`
2. 긴 변 2000px, 1MB 이하로 줄입니다.
3. 알맞은 `media/...` 폴더에 올립니다.
4. `content.js` 의 해당 `photos` 목록에 한 줄을 추가합니다.

```js
{ src: "media/jeongseon/beteul-01.jpg", alt: "베틀 앞에 앉은 손", caption: "정선, 2026년 8월", credit: "사진: 이은선" },
```

예시 파일(`example-…`)은 실제 파일로 바꾼 뒤 지워 주세요.
