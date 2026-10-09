---
title: React chat virtual list without scroll jump
description: Build a virtualized React chat list with reverse infinite scroll that keeps the scroll position stable when loading older messages, receiving new ones or resizing items.
---

# React chat virtual list without scroll jump

Chat UIs load history upwards, append new messages at the bottom and render items whose height
changes after images or embeds load. anchorlist keeps the message you are reading in place through
all of these.

Coming in v0.1.
