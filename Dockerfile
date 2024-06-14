
FROM node:20-alpine
ENV TZ="America/Denver"

ENV USER ezd
ENV HOME /home/$USER
WORKDIR $HOME
RUN apk update && apk add bash && apk add vim
RUN apk add zsh
RUN apk add curl
RUN apk add wget
RUN apk add git
RUN apk add sudo
RUN sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
RUN git clone https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions
RUN git clone https://github.com/zsh-users/zsh-syntax-highlighting.git ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting

COPY .zshrc .
COPY .env* .
COPY sysmon-startup.sh .

COPY package.json .
COPY package-lock.json* .
COPY src/ src
COPY tsconfig.json .
COPY .eslintrc.js .

RUN npm ci
RUN npm run build