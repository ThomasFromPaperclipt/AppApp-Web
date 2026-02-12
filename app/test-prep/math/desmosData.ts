export interface Question {
    id: string;
    text: string;
    expression?: string;
    correctAnswer: string;
    acceptableAnswers: string[]; // List of valid answers
    hint?: string;
    graphCheck?: string;
    desmosExpressions?: { id: string; latex: string }[];
}

export interface Lesson {
    id: string;
    title: string;
    icon: string;
    description: string;
    content: string;
    proTip?: {
        title: string;
        text: string;
    };
    questions: Question[];
}

export const desmosLessons: Lesson[] = [
    {
        id: 'linear',
        title: 'Solving Linear Equations',
        icon: '📈',
        description: 'Learn how to solve equations by graphing them.',
        content: 'You can solve almost any equation by graphing it! If you have an equation like 3x + 5 = 14, you can simply type it into Desmos.',
        proTip: {
            title: 'Pro Tip',
            text: 'Desmos will graph a vertical line at the x-value that solves the equation. Just click on the line to see the coordinate!'
        },
        questions: [
            {
                id: 'linear1',
                text: 'Solve for x: 4x - 7 = 2x + 9',
                correctAnswer: '8',
                acceptableAnswers: ['8', 'x=8', 'x = 8'],
                graphCheck: "I've graphed it for you! Look for the vertical line at x = 8.",
                desmosExpressions: [
                    { id: 'linear1', latex: '4x - 7 = 2x + 9' }
                ]
            },
            {
                id: 'linear2',
                text: 'Solve for x: 2(x + 3) = 14',
                correctAnswer: '4',
                acceptableAnswers: ['4', 'x=4', 'x = 4'],
                graphCheck: "Check the vertical line intersection.",
                desmosExpressions: [
                    { id: 'linear2', latex: '2(x + 3) = 14' }
                ]
            },
            {
                id: 'linear3',
                text: 'Solve for x: -3x + 5 = 2x - 10',
                correctAnswer: '3',
                acceptableAnswers: ['3', 'x=3', 'x = 3'],
                graphCheck: "Where do the lines cross?",
                desmosExpressions: [
                    { id: 'linear3', latex: '-3x + 5 = 2x - 10' }
                ]
            }
        ]
    },
    {
        id: 'system',
        title: 'Systems of Equations',
        icon: '❌',
        description: 'Find where two lines intersect visually.',
        content: 'Finding where two lines intersect is incredibly easy. Just type both equations into separate lines in the calculator.',
        proTip: {
            title: 'Click the Intersection',
            text: 'Desmos automatically highlights intersection points with gray dots. Click the dot to see the exact (x, y) coordinates.'
        },
        questions: [
            {
                id: 'sys1',
                text: 'Find the solution (x, y) to the system:\ny = 2x + 3\ny = -x + 9',
                correctAnswer: '(2, 7)',
                acceptableAnswers: ['(2, 7)', '(2,7)', '2, 7', '2,7'],
                graphCheck: "I've graphed both lines. Click the intersection point to verify!",
                desmosExpressions: [
                    { id: 'sys1', latex: 'y = 2x + 3' },
                    { id: 'sys2', latex: 'y = -x + 9' }
                ]
            },
            {
                id: 'sys2',
                text: 'Find the intersection of:\ny = 3x - 2\ny = x + 4',
                correctAnswer: '(3, 7)',
                acceptableAnswers: ['(3, 7)', '(3,7)', '3, 7', '3,7'],
                graphCheck: "Look for the crossing point.",
                desmosExpressions: [
                    { id: 'sys2a', latex: 'y = 3x - 2' },
                    { id: 'sys2b', latex: 'y = x + 4' }
                ]
            },
            {
                id: 'sys3',
                text: 'Solve the system:\n2x + y = 10\nx - y = 2',
                correctAnswer: '(4, 2)',
                acceptableAnswers: ['(4, 2)', '(4,2)', '4, 2', '4,2'],
                graphCheck: "Click the intersection.",
                desmosExpressions: [
                    { id: 'sys3a', latex: '2x + y = 10' },
                    { id: 'sys3b', latex: 'x - y = 2' }
                ]
            }
        ]
    },
    {
        id: 'quadratic',
        title: 'Quadratics & Parabolas',
        icon: '🔄',
        description: 'Find vertices and roots without factoring.',
        content: 'Need to find the vertex (maximum/minimum) or the roots (x-intercepts) of a parabola? Graphing is faster than factoring!',
        questions: [
            {
                id: 'quad1',
                text: 'Find the vertex of: y = x^2 - 6x + 5',
                correctAnswer: '(3, -4)',
                acceptableAnswers: ['(3, -4)', '(3,-4)', '3, -4', '3,-4'],
                graphCheck: 'Graph the equation. Click the lowest point (the minimum) to see the vertex coordinates.',
                desmosExpressions: [
                    { id: 'quad1', latex: 'y = x^2 - 6x + 5' }
                ]
            },
            {
                id: 'quad2',
                text: 'Find the positive x-intercept of: y = x^2 - 4',
                correctAnswer: '2',
                acceptableAnswers: ['2', 'x=2', '(2,0)', '(2, 0)'],
                graphCheck: "Look where it crosses the x-axis on the right.",
                desmosExpressions: [
                    { id: 'quad2', latex: 'y = x^2 - 4' }
                ]
            },
            {
                id: 'quad3',
                text: 'Find the maximum value (y-coordinate) of: y = -x^2 + 4x + 1',
                correctAnswer: '5',
                acceptableAnswers: ['5', 'y=5'],
                graphCheck: "Find the highest point.",
                desmosExpressions: [
                    { id: 'quad3', latex: 'y = -x^2 + 4x + 1' }
                ]
            }
        ]
    },
    {
        id: 'inequalities',
        title: 'Inequalities',
        icon: '🌓',
        description: 'Visualize solution regions for inequalities.',
        content: 'Desmos handles inequalities beautifully. It automatically shades the correct region and uses dashed lines for strict inequalities (< or >) and solid lines for inclusive ones (≤ or ≥).',
        questions: [
            {
                id: 'ineq1',
                text: 'Graph the system:\ny > 2x - 1\ny ≤ -0.5x + 4',
                correctAnswer: 'graphed',
                acceptableAnswers: ['graphed', 'done', 'ok', 'yes'],
                graphCheck: "Notice the overlapping shaded region. That's your solution set!",
                desmosExpressions: [
                    { id: 'ineq1', latex: 'y > 2x - 1' },
                    { id: 'ineq2', latex: 'y <= -0.5x + 4' }
                ]
            },
            {
                id: 'ineq2',
                text: 'Is the point (0, 0) a solution to y < x + 1?',
                correctAnswer: 'yes',
                acceptableAnswers: ['yes', 'true', 'y'],
                graphCheck: "Check if (0,0) is in the shaded region.",
                desmosExpressions: [
                    { id: 'ineq2', latex: 'y < x + 1' },
                    { id: 'pt1', latex: '(0,0)' }
                ]
            },
            {
                id: 'ineq3',
                text: 'Graph x^2 + y^2 < 9',
                correctAnswer: 'graphed',
                acceptableAnswers: ['graphed', 'done', 'ok', 'yes'],
                graphCheck: "You should see a shaded circle with a dashed border.",
                desmosExpressions: [
                    { id: 'ineq3', latex: 'x^2 + y^2 < 9' }
                ]
            }
        ]
    },
    {
        id: 'sliders',
        title: 'Using Sliders',
        icon: '🎚️',
        description: 'See how variables affect graphs dynamically.',
        content: "Sliders are one of Desmos's best features. If you type an equation with undefined variables (like m or b), Desmos will ask if you want to add sliders. This lets you see how changing a value affects the graph.",
        questions: [
            {
                id: 'slider1',
                text: 'Graph y = mx + b and play with the sliders.',
                correctAnswer: 'played',
                acceptableAnswers: ['played', 'done', 'ok', 'yes'],
                graphCheck: "See how 'm' changes the slope and 'b' changes the y-intercept?",
                desmosExpressions: [
                    { id: 'slider1', latex: 'y = mx + b' },
                    { id: 'm_slider', latex: 'm = 1' },
                    { id: 'b_slider', latex: 'b = 0' }
                ]
            },
            {
                id: 'slider2',
                text: 'Set m = 2 and b = -1. What is the x-intercept?',
                correctAnswer: '0.5',
                acceptableAnswers: ['0.5', '1/2', '(0.5, 0)', '(0.5,0)'],
                graphCheck: "Adjust sliders to m=2, b=-1 and click the x-intercept.",
                desmosExpressions: [
                    { id: 'slider1', latex: 'y = mx + b' },
                    { id: 'm_slider', latex: 'm = 2' },
                    { id: 'b_slider', latex: 'b = -1' }
                ]
            },
            {
                id: 'slider3',
                text: 'Graph y = a(x-h)^2 + k. What does "k" do?',
                correctAnswer: 'vertical shift',
                acceptableAnswers: ['vertical shift', 'moves up and down', 'up and down', 'shift up down', 'vertical'],
                graphCheck: "Move the k slider.",
                desmosExpressions: [
                    { id: 'slider3', latex: 'y = a(x-h)^2 + k' },
                    { id: 'a_sl', latex: 'a=1' },
                    { id: 'h_sl', latex: 'h=0' },
                    { id: 'k_sl', latex: 'k=0' }
                ]
            }
        ]
    },
    {
        id: 'circles',
        title: 'Circle Equations',
        icon: '⭕',
        description: 'Visualize circle centers and radii.',
        content: 'The standard equation for a circle is (x - h)^2 + (y - k)^2 = r^2, where (h, k) is the center and r is the radius. Desmos makes it easy to visualize this.',
        questions: [
            {
                id: 'circle1',
                text: 'Graph: (x - 2)^2 + (y + 3)^2 = 25',
                correctAnswer: 'Center (2, -3), Radius 5',
                acceptableAnswers: ['graphed', 'done', 'ok', 'yes'],
                graphCheck: 'Check the graph to verify the center and count the radius units!',
                desmosExpressions: [
                    { id: 'circle1', latex: '(x - 2)^2 + (y + 3)^2 = 25' }
                ]
            },
            {
                id: 'circle2',
                text: 'Find the radius of: x^2 + y^2 = 49',
                correctAnswer: '7',
                acceptableAnswers: ['7', 'r=7'],
                graphCheck: "Count the units from the center to the edge.",
                desmosExpressions: [
                    { id: 'circle2', latex: 'x^2 + y^2 = 49' }
                ]
            },
            {
                id: 'circle3',
                text: 'Find the center of: (x+1)^2 + (y-4)^2 = 1',
                correctAnswer: '(-1, 4)',
                acceptableAnswers: ['(-1, 4)', '(-1,4)', '-1, 4', '-1,4'],
                graphCheck: "Click the center point if you graphed it.",
                desmosExpressions: [
                    { id: 'circle3', latex: '(x+1)^2 + (y-4)^2 = 1' }
                ]
            }
        ]
    },
    {
        id: 'regression',
        title: 'Regressions',
        icon: '📉',
        description: 'Find the line of best fit for data tables.',
        content: 'Desmos can instantly find the line (or curve) of best fit for a set of data. This is called regression. You use the tilde symbol (~) instead of an equals sign (=).',
        proTip: {
            title: 'The Magic Tilde (~)',
            text: 'To do a regression, type y1 ~ mx1 + b. The ~ tells Desmos to approximate the best fit. Make sure to use y1 and x1 to match your table headers!'
        },
        questions: [
            {
                id: 'reg1',
                text: 'Given the points (1, 3), (2, 5), (3, 7), find the linear regression equation.',
                correctAnswer: 'y = 2x + 1',
                acceptableAnswers: ['y = 2x + 1', 'y=2x+1', '2x+1'],
                graphCheck: "Add a table with the points, then type y1 ~ mx1 + b. Look at m and b.",
                desmosExpressions: [
                    { id: 'reg1_table', latex: '\\text{table}' }, // Note: This is a placeholder, actual table syntax is complex in string
                    { id: 'reg1_eq', latex: 'y_1 \\sim mx_1 + b' }
                ]
            },
            {
                id: 'reg2',
                text: 'Find the exponential regression for (0, 2), (1, 6), (2, 18).',
                correctAnswer: 'y = 2(3)^x',
                acceptableAnswers: ['y = 2(3)^x', 'y=2*3^x', '2(3)^x'],
                graphCheck: "Type y1 ~ ab^x1. Check the values of a and b.",
                desmosExpressions: [
                    { id: 'reg2_eq', latex: 'y_1 \\sim ab^{x_1}' }
                ]
            },
            {
                id: 'reg3',
                text: 'Predict y when x = 10 for the line of best fit: (1, 5), (3, 9), (5, 13).',
                correctAnswer: '23',
                acceptableAnswers: ['23', 'y=23'],
                graphCheck: "Find the equation first, then plug in x=10.",
                desmosExpressions: [
                    { id: 'reg3_eq', latex: 'y_1 \\sim mx_1 + b' }
                ]
            }
        ]
    }
];
