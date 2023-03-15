# WebRTC SFU 구현

- 자세한 구현과정과 정리된 내용은 아래 링크의 제 notion에 정리해두었습니다.
  https://early-profit-078.notion.site/WebRTC-SFU-f1e14e96c09a4e128e0615a84f34e088

## 파일 설명

- src/server_basicMesh.js : 간단한 1:1 WebRTC 화상통화용 서버 파일입니다
- src/server_manyconnections.js : millo님의 블로그 글을 참고하여 구현한 다중 webRTC SFU 미디어 서버 파일입니다.
  - 단방향 연결의 수가 너무 많아져서 각 연결이 불안정해지는 문제가 있습니다.
  - 참고링크 : https://millo-l.github.io/WebRTC-%EA%B5%AC%ED%98%84%ED%95%98%EA%B8%B0-1-N-SFU/
- src/server_sfuServer.js : 위의 SFU 구현방식을 바꿔서 client들과 server간의 연결의 수를 늘리는 방식이 아니라 하나의 연결에 다른 사람들의 stream을 추가하는 방식으로 구현했습니다
  - 연결이 안정적이며 프로젝트에서 사용한 최종 서버 파일입니다.

## 주의사항

- WebRTC 서버 구현을 위한 wrtc 모듈은 nodejs v14.x.x까지밖에 지원하지 않습니다.
  - 그래서 저는 v12.22.12버전 사용했습니다.
- local에서 서버를 돌리되 다른 host와 통화를 진행할 떄에는 ngrok을 통해 로컬 네트워크의 터널을 열어주세요.
- 같은 LAN 환경이 아니라면 Stun 서버가 필요합니다.
  - stun 서버는 google에서 무료로 제공하는 서버들이 있으니 URL을 찾아 넣으시면 됩니다
  - 제가 이미 넣어놓긴 했습니다.
- 접속자의 방화벽 설정을 이유로 서버로의 P2P 연결이 안될 수 있습니다
  - 이땐 relay를 위한 turn 서버가 필요합니다.
  - coturn을 이용하여 turn 서버를 구축해주세요.(과정이 간단하니까 후딱해놓는게 마음 편합니다.)
  - 참조 링크 : https://my-first-programming.tistory.com/entry/AWS-EC2-COTURN-%EC%84%9C%EB%B2%84

## 브랜치 설명

### main branch

- localhost용 브랜치 입니다.
- local에서 간단하게 테스트 하기 위해서 사용하기 좋습니다.
- ngrok을 이용하여 터널을 열어주면 다른 host도 참여 가능합니다.

### ForProjectServer branch

- 다른 프로젝트에 적용할 수 있는 SFU용 Media 서버용 브랜치 입니다.
- 웹캠과 마이크와 같이 유저의 미디어 기기에 접근하기 위해서는 접근하는 웹사이트의 도메인이 https로 시작해야 합니다
  - 즉 https 보안 프로토콜이어야 합니다.
  - nginx를 통해 SSL인증을 비교적 편하게 얻을 수 있습니다.
- 프로젝트에 사용하실 때에는 cors 설정과 path 설정에 유의해야 합니다.
  - socket.io는 내부적으로 cors 옵션을 제공합니다. origin을 꼭 설정해주세요
  - cors 옵션에 credential을 true로 하면 cookie데이터도 같이 서버로 전해지게 되는데 이때 cors의 origin설정을 "\*"(wildcard라고 부름)로 해놓았다면 cors에러가 나게 됩니다. 꼭 허용할 URL을 특정해주세요.
  - https 보안 인증을 받은 도메인에서 http 도메인에 socket 연결을 할 수 없습니다.
    - nginx로 보안 인증을 받으셨다면 SFU 서버도 해당 리버스 프록시 뒤에 위치시키면 문제가 해결됩니다.
- 미디어서버를 이용한 프로젝트 github : https://github.com/ChoongilLee95/OneMinuteMemory
- 위 repository에서 namanmoo/client/src/room/components/WebRTC/WebRTC.js 파일은 클라이언트의 webRTC연결을 위한 코드가 있습니다. 이 코드와 src/server_sfuServer.js의 코드를 같이 보시면 클라이언트와 서버가 어떻게 연결되었는지 알 수 있습니다.

## 시작하기

- 시작을 위한 커멘드라인 명령어는 다음과 같습니다

  `$ npm run dev`
