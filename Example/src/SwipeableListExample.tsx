import React from 'react';
import {
  Alert,
  Dimensions,
  StyleSheet,
  Text,
  TextStyle,
  TouchableHighlight,
  View,
  ViewStyle,
} from 'react-native';
import {
  FlatList,
  GestureEventPayload,
  PanGestureHandler,
  PanGestureHandlerEventPayload,
  PanGestureHandlerGestureEvent,
  TouchableOpacity,
} from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const windowDimensions = Dimensions.get('window');
const BUTTON_WIDTH = 60;
const BUTTON_HEIGHT = 78;
const MAX_X_RIGHT = BUTTON_WIDTH * 2;

type Data = {
  id: string;
  title: string;
};
const initialData: Data[] = [
  {
    id: '1',
    title: 'Kate Bell',
  },
  {
    id: '2',
    title: 'John Appleseed',
  },
  {
    id: '3',
    title: 'Steve Jobs',
  },
  {
    id: '4',
    title: 'Iron Man',
  },
  {
    id: '5',
    title: 'Captain America',
  },
  {
    id: '6',
    title: 'Batman',
  },
  {
    id: '7',
    title: 'Matt Smith',
  },
];

function SwipableList(): React.ReactElement {
  const [data, setData] = React.useState<Data[]>(initialData);
  const rowsRef = React.useRef<
    Record<string, { closeRow: () => void }> | Record<string, never>
  >({});
  const openedRowRef = React.useRef('');

  React.useEffect(() => {
    rowsRef.current = {};
    data.forEach((d) => {
      rowsRef.current[d.id] = {
        closeRow: () => {
          //
        },
      };
    });
  }, [data]);

  function onRemove(id: string) {
    setData(data.filter((d) => d.id !== id));
  }

  function onFollow(title: string) {
    Alert.alert('Following', title);
  }

  return (
    <View style={s.container}>
      <FlatList
        data={data}
        renderItem={({ item }) => {
          return (
            <ListItem
              openedRowRef={openedRowRef}
              rowsRef={rowsRef}
              item={item}
              onFollow={onFollow}
              onRemove={onRemove}
            />
          );
        }}
        keyExtractor={(item) => item.id}
      />
    </View>
  );
}

const springConfig = (velocity: number) => {
  'worklet';

  return {
    stiffness: 1000,
    damping: 500,
    mass: 3,
    overshootClamping: true,
    restDisplacementThreshold: 0.01,
    restSpeedThreshold: 0.01,
    velocity,
  };
};

const timingConfig = {
  duration: 200,
  easing: Easing.bezierFn(0.25, 0.1, 0.25, 1),
};

type ListItemProps = {
  item: Data;
  openedRowRef: React.MutableRefObject<string>;
  rowsRef: React.MutableRefObject<
    | Record<
        string,
        {
          closeRow: () => void;
        }
      >
    | Record<string, never>
  >;
  onFollow: (title: string) => void;
  onRemove: (id: string) => void;
};

type AnimatedGHContext = {
  startX: number;
};

type GestureEvent = Readonly<
  GestureEventPayload & PanGestureHandlerEventPayload
>;

type OpeningSide = 'left' | 'right' | '';

function ListItem({
  item,
  openedRowRef,
  rowsRef,
  onFollow,
  onRemove,
}: ListItemProps) {
  const followButton = {
    title: 'Follow',
    backgroundColor: 'green',
    color: 'white',
    onPress: handleFollow,
  };

  const deleteButton = {
    title: 'Delete',
    backgroundColor: 'red',
    color: 'white',
    onPress: handleRemove,
  };

  const moreButton = {
    title: 'More',
    backgroundColor: 'gray',
    color: 'white',
    onPress: handleMore,
  };

  const shouldFollow = useSharedValue(false);
  const isRemoving = useSharedValue(false);
  const shouldRemove = useSharedValue(false);
  const isRightActionsShow = useSharedValue(false);
  const translateX = useSharedValue(0);
  const velocityX = useSharedValue(0);
  const openingSide = useSharedValue<OpeningSide>('');
  const btnLeftStyles = useAnimatedStyle(() => ({
    backgroundColor:
      openingSide.value === 'left'
        ? followButton.backgroundColor
        : 'transparent',
    ...s.leftButton,
  }));
  const btnDeleteRightStyles = useAnimatedStyle(() => ({
    backgroundColor:
      openingSide.value === 'right'
        ? deleteButton.backgroundColor
        : 'transparent',
    ...s.rightButton,
  }));
  const btnMoreRightStyles = useAnimatedStyle(() => ({
    backgroundColor:
      openingSide.value === 'right'
        ? moreButton.backgroundColor
        : 'transparent',
    ...s.rightButton,
  }));
  const textLeftStyles = useAnimatedStyle(() => ({
    color: openingSide.value === 'left' ? followButton.color : 'transparent',
  }));
  const textRightStyles = useAnimatedStyle(() => ({
    color: openingSide.value === 'right' ? deleteButton.color : 'transparent',
  }));

  rowsRef.current[item.id] = {
    closeRow: () => {
      'worklet';
      translateX.value = withSpring(0, springConfig(MAX_X_RIGHT), () => {
        openingSide.value = '';
      });
    },
  };

  function handleRemove() {
    return () => {
      isRemoving.value = true;
    };
  }

  function handleMore(data?: Data) {
    return () => {
      console.log('more', data);
    };
  }

  function handleFollow() {
    return () => {
      console.log('follow');
    };
  }

  const closeOpenedRow = () => {
    'worklet';
    if (
      !isRemoving.value &&
      openedRowRef.current &&
      openedRowRef.current !== item.id
    ) {
      rowsRef.current[openedRowRef.current].closeRow();
    }
    openedRowRef.current = item.id;
  };

  const getOpeningSide = (evt: GestureEvent): OpeningSide => {
    'worklet';
    if (!openingSide.value) {
      return evt.translationX < 0 ? 'right' : 'left';
    }
    return openingSide.value;
  };

  const onOpeningLeftActive = (
    evt: GestureEvent,
    ctx: AnimatedGHContext
  ): void => {
    'worklet';
    velocityX.value = evt.velocityX;
    const nextTranslate = evt.translationX + ctx.startX;
    if (evt.velocityX > 0 && translateX.value >= windowDimensions.width / 2) {
      translateX.value = withSpring(
        Math.min(translateX.value + 1, windowDimensions.width / 2 + 20),
        springConfig(evt.velocityX)
      );
    } else if (
      evt.velocityX < 0 ||
      translateX.value >= windowDimensions.width / 2
    ) {
      translateX.value = withSpring(
        Math.min(nextTranslate, windowDimensions.width / 2 + 20),
        springConfig(evt.velocityX)
      );
    } else {
      translateX.value = withSpring(
        Math.max(nextTranslate / 10, nextTranslate),
        springConfig(evt.velocityX)
      );
    }
  };

  const onOpeningLeftEnd = (evt: GestureEvent): void => {
    'worklet';
    translateX.value = withSpring(0, springConfig(evt.velocityX), () => {
      openingSide.value = '';
    });
    if (shouldFollow.value) {
      runOnJS(onFollow)(item.title);
    }
  };

  const onOpeningRightActive = (
    evt: GestureEvent,
    ctx: AnimatedGHContext
  ): void => {
    'worklet';
    const nextTranslate = evt.translationX + ctx.startX;
    if (
      nextTranslate < -(windowDimensions.width / 2) &&
      evt.velocityX > -MAX_X_RIGHT
    ) {
      translateX.value = withTiming(
        -windowDimensions.width,
        { duration: Math.abs(evt.velocityX) + MAX_X_RIGHT },
        () => {
          shouldRemove.value = true;
        }
      );
    } else if (
      !isRightActionsShow.value &&
      nextTranslate < -(windowDimensions.width / 2)
    ) {
      translateX.value = withSpring(
        -MAX_X_RIGHT,
        springConfig(evt.velocityX),
        () => {
          shouldRemove.value = false;
          isRightActionsShow.value = true;
        }
      );
    } else {
      translateX.value = withSpring(
        Math.min(nextTranslate / 10, nextTranslate),
        springConfig(evt.velocityX),
        () => {
          shouldRemove.value = false;
        }
      );
    }
  };

  const onOpeningRightEnd = (evt: GestureEvent): void => {
    'worklet';
    if (shouldRemove.value) {
      isRemoving.value = true;
    } else if (
      translateX.value <= -MAX_X_RIGHT ||
      evt.velocityX < -(windowDimensions.width / 2)
    ) {
      translateX.value = withSpring(
        -MAX_X_RIGHT,
        springConfig(evt.velocityX),
        () => {
          isRemoving.value = false;
          isRightActionsShow.value = true;
        }
      );
    } else {
      translateX.value = withSpring(0, springConfig(evt.velocityX), () => {
        isRemoving.value = false;
        isRightActionsShow.value = false;
        openingSide.value = '';
      });
    }
  };

  const handler = useAnimatedGestureHandler<
    PanGestureHandlerGestureEvent,
    AnimatedGHContext
  >({
    onStart: (_evt, ctx) => {
      ctx.startX = translateX.value;
      closeOpenedRow();
      shouldFollow.value = false;
      shouldRemove.value = false;
      isRemoving.value = false;
    },

    onActive: (evt, ctx) => {
      openingSide.value = getOpeningSide(evt);
      if (openingSide.value === 'right') {
        onOpeningRightActive(evt, ctx);
      } else {
        onOpeningLeftActive(evt, ctx);
      }
    },

    onEnd: (evt) => {
      if (openingSide.value === 'right') {
        onOpeningRightEnd(evt);
      } else {
        onOpeningLeftEnd(evt);
      }
    },
  });

  const styles = useAnimatedStyle(() => {
    if (isRemoving.value) {
      return {
        height: withTiming(0, timingConfig, () => {
          openedRowRef.current = '';
          runOnJS(onRemove)(item.id);
          runOnJS(Alert.alert)('Removed');
        }),
        transform: [
          {
            translateX: withTiming(-windowDimensions.width, timingConfig),
          },
        ],
      };
    }

    return {
      height: BUTTON_HEIGHT,
      transform: [
        {
          translateX: translateX.value,
        },
      ],
    };
  });

  const btnDeleteStyles = useAnimatedStyle(() => {
    if (shouldRemove.value || isRemoving.value) {
      return {
        left: withTiming(windowDimensions.width, {
          duration: 10,
        }),
      };
    }

    return {
      left: withTiming(
        windowDimensions.width +
          Math.min(Math.abs(translateX.value) / 2, BUTTON_WIDTH),
        { duration: 10 }
      ),
    };
  });

  const btnFollowStyles = useAnimatedStyle(() => {
    if (translateX.value >= windowDimensions.width / 2) {
      shouldFollow.value = true;
      return {
        left: withTiming(-BUTTON_WIDTH, { duration: 100 }),
      };
    } else if (translateX.value >= BUTTON_WIDTH) {
      if (shouldFollow.value) {
        shouldFollow.value = false;
        return {
          left: withTiming(-translateX.value, { duration: 100 }),
        };
      } else {
        console.log(translateX.value, velocityX.value);
        if (velocityX.value < 0) {
          return {
            left:
              translateX.value <= windowDimensions.width / 2 - 30
                ? -translateX.value
                : withTiming(-translateX.value, {
                    duration: 50,
                  }),
          };
        } else {
          return {
            left: -translateX.value,
          };
        }
      }
    }

    return {
      left: -BUTTON_WIDTH,
    };
  });

  return (
    <TouchableHighlight
      style={s.item}
      underlayColor="#ddd"
      onPress={() => {
        //
      }}>
      <PanGestureHandler activeOffsetX={[0, 20]} onGestureEvent={handler}>
        <Animated.View style={[styles]}>
          <ListItemContent item={item} />

          <View style={[s.leftButtonsContainer]}>
            <Button
              item={followButton}
              data={item}
              viewStyles={btnLeftStyles}
              textStyles={{ color: 'transparent' }}
            />
          </View>
          <View>
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  top: -BUTTON_HEIGHT,
                  left: -BUTTON_WIDTH,
                  height: BUTTON_HEIGHT,
                  width: BUTTON_WIDTH,
                },
                btnFollowStyles,
              ]}>
              <Button
                item={followButton}
                data={item}
                viewStyles={btnLeftStyles}
                textStyles={textLeftStyles}
              />
            </Animated.View>
          </View>
          <View style={s.rightButtonsContainer}>
            <Button
              item={moreButton}
              data={item}
              viewStyles={btnMoreRightStyles}
              textStyles={textRightStyles}
            />
          </View>
          <Animated.View style={[s.rightButtonsContainer, btnDeleteStyles]}>
            <Button
              item={deleteButton}
              viewStyles={btnDeleteRightStyles}
              textStyles={textRightStyles}
            />
          </Animated.View>
        </Animated.View>
      </PanGestureHandler>
    </TouchableHighlight>
  );
}

type ButtonData = {
  title: string;
  backgroundColor: string;
  color: string;
  onPress: (data?: Data) => () => void;
};

function Button({
  item,
  data,
  viewStyles,
  textStyles,
}: {
  item: ButtonData;
  data?: Data;
  viewStyles: ViewStyle;
  textStyles: TextStyle;
}) {
  return (
    <Animated.View style={[viewStyles]}>
      <TouchableOpacity onPress={item.onPress(data)} style={s.buttonInner}>
        <Animated.Text style={[textStyles]}>{item.title}</Animated.Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function ListItemContent({ item }: { item: Data }) {
  return (
    <View style={s.itemContainer}>
      <View style={s.avatarContainer}>
        <Text style={s.avatarText}>{item.title[0]}</Text>
      </View>
      <Text style={s.title}>{item.title}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  item: {
    flex: 1,
  },
  itemContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'grey',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    color: 'white',
  },
  title: {
    fontSize: 18,
    marginLeft: 16,
  },
  leftButton: {
    width: -windowDimensions.width,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  rightButton: {
    width: windowDimensions.width,
    paddingRight: windowDimensions.width - BUTTON_WIDTH,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonInner: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    width: BUTTON_WIDTH,
  },
  leftButtonsContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: -windowDimensions.width,
    width: windowDimensions.width,
  },
  rightButtonsContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: windowDimensions.width,
    width: windowDimensions.width,
  },
});

export default SwipableList;
