import React from 'react';
import {
  Alert,
  Dimensions,
  StyleSheet,
  Text,
  TouchableHighlight,
  View,
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
  const prevRowRef = React.useRef('');

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
    Alert.alert('Removed');
  }

  return (
    <View style={s.container}>
      <FlatList
        data={data}
        renderItem={({ item }) => {
          return (
            <ListItem
              prevRowRef={prevRowRef}
              rowsRef={rowsRef}
              item={item}
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
  duration: 400,
  easing: Easing.bezierFn(0.25, 0.1, 0.25, 1),
};

type ListItemProps = {
  item: Data;
  prevRowRef: React.MutableRefObject<string>;
  rowsRef: React.MutableRefObject<
    | Record<
        string,
        {
          closeRow: () => void;
        }
      >
    | Record<string, never>
  >;
  onRemove: (id: string) => void;
};

type AnimatedGHContext = {
  startX: number;
};

type GestureEvent = Readonly<
  GestureEventPayload & PanGestureHandlerEventPayload
>;

type OpeningSide = 'left' | 'right';

function ListItem({ item, prevRowRef, rowsRef, onRemove }: ListItemProps) {
  const isRemoving = useSharedValue(false);
  const shouldRemove = useSharedValue(false);
  const isRightActionsShow = useSharedValue(false);
  const translateX = useSharedValue(0);
  const openingSide = useSharedValue<OpeningSide | undefined>(undefined);

  const getOpeningSide = (evt: GestureEvent): OpeningSide => {
    'worklet';
    if (!openingSide.value) {
      return evt.translationX < 0 ? 'right' : 'left';
    }
    return openingSide.value;
  };

  rowsRef.current[item.id] = {
    closeRow: () => {
      'worklet';
      if (translateX.value < 0) {
        translateX.value = withSpring(0, springConfig(MAX_X_RIGHT));
      }
    },
  };

  const onActiveOpeningRight = (
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
        Math.min(nextTranslate / 8, nextTranslate),
        springConfig(evt.velocityX),
        () => {
          shouldRemove.value = false;
        }
      );
    }
  };

  const onEndOpeningRight = (evt: GestureEvent): void => {
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
        openingSide.value = undefined;
      });
    }
  };

  const handler = useAnimatedGestureHandler<
    PanGestureHandlerGestureEvent,
    AnimatedGHContext
  >({
    onStart: (_evt, ctx) => {
      ctx.startX = translateX.value;
      if (
        !isRemoving.value &&
        prevRowRef.current &&
        prevRowRef.current !== item.id
      ) {
        rowsRef.current?.[prevRowRef.current]?.closeRow();
      }
      prevRowRef.current = item.id;
      shouldRemove.value = false;
      isRemoving.value = false;
    },

    onActive: (evt, ctx) => {
      openingSide.value = getOpeningSide(evt);
      if (openingSide.value === 'right') {
        onActiveOpeningRight(evt, ctx);
      }
    },

    onEnd: (evt) => {
      if (openingSide.value === 'right') {
        onEndOpeningRight(evt);
      }
    },
  });

  const styles = useAnimatedStyle(() => {
    if (isRemoving.value) {
      return {
        height: withTiming(0, timingConfig, () => {
          prevRowRef.current = '';
          runOnJS(onRemove)(item.id);
        }),
        transform: [
          {
            translateX: withTiming(-windowDimensions.width, timingConfig),
          },
        ],
      };
    }

    return {
      height: 78,
      transform: [
        {
          translateX: translateX.value,
        },
      ],
    };
  });

  const btnDeleteStyles = useAnimatedStyle(() => {
    if (shouldRemove.value) {
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

          <View style={s.buttonsContainer}>
            <Button item={moreButton} data={item} />
          </View>
          <Animated.View style={[s.buttonsContainer, btnDeleteStyles]}>
            <Button item={deleteButton} />
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
function Button({ item, data }: { item: ButtonData; data?: Data }) {
  return (
    <View style={[s.button, { backgroundColor: item.backgroundColor }]}>
      <TouchableOpacity onPress={item.onPress(data)} style={s.buttonInner}>
        <Text style={{ color: item.color }}>{item.title}</Text>
      </TouchableOpacity>
    </View>
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
  button: {
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
  buttonsContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: windowDimensions.width,
    width: windowDimensions.width,
  },
});

export default SwipableList;
