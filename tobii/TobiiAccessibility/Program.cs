// TobiiAccessibility - WebSocket bridge publishing gaze points from Tobii to localhost.
// Requires: .NET Framework 4.8, Tobii.Interaction (NuGet), Fleck (NuGet), Newtonsoft.Json (NuGet).

using System;
using System.Collections.Generic;
using System.CommandLine;
using System.Linq;
using Newtonsoft.Json;
using Fleck;
using Tobii.Interaction;

namespace TobiiAccessibility
{
    public class GazeMessage
    {
        public double x { get; set; }
        public double y { get; set; }
        public long ts { get; set; }
        public bool valid { get; set; }
    }

    public class Program
    {
        public static int Main(string[] args)
        {
            var hostOpt = new Option<string>("--host", () => "127.0.0.1", "WebSocket host (use 127.0.0.1 for local only)");
            var portOpt = new Option<int>("--port", () => 8765, "WebSocket port");

            var root = new RootCommand("Tobii -> WebSocket bridge");
            root.AddOption(hostOpt);
            root.AddOption(portOpt);
            root.SetHandler((string hostBind, int port) => Run(hostBind, port), hostOpt, portOpt);

            return root.Invoke(args);
        }

        static void Run(string hostBind, int port)
        {
            string url = $"ws://{hostBind}:{port}";
            Console.WriteLine($"[bridge] Starting WebSocket server at {url}");

            var server = new WebSocketServer(url);
            var clients = new List<IWebSocketConnection>();
            server.Start(socket =>
            {
                socket.OnOpen = () =>
                {
                    clients.Add(socket);
                    Console.WriteLine($"[bridge] Client connected: {socket.ConnectionInfo.ClientIpAddress}");
                };
                socket.OnClose = () =>
                {
                    clients.Remove(socket);
                    Console.WriteLine($"[bridge] Client disconnected");
                };
            });

            try
            {
                Console.WriteLine("[bridge] Checking Tobii environment...");
                
                // Check if Tobii services are running
                var tobiiProcesses = System.Diagnostics.Process.GetProcesses()
                    .Where(p => p.ProcessName.ToLower().Contains("tobii"))
                    .ToList();
                
                if (tobiiProcesses.Count == 0)
                {
                    Console.WriteLine("[bridge] Warning: No Tobii processes found running.");
                    Console.WriteLine("[bridge] Please ensure Tobii Experience or Tobii Game Hub is running.");
                }
                else
                {
                    Console.WriteLine($"[bridge] Found {tobiiProcesses.Count} Tobii processes running:");
                    foreach (var proc in tobiiProcesses)
                    {
                        Console.WriteLine($"[bridge]   - {proc.ProcessName}");
                    }
                }

                Console.WriteLine("[bridge] Attempting to initialize Tobii host...");
                var host = new Host();
                
                Console.WriteLine("[bridge] Creating gaze point data stream...");
                var stream = host.Streams.CreateGazePointDataStream();
                
                stream.GazePoint((x, y, ts) =>
                {
                    var msg = new GazeMessage
                    {
                        x = x,
                        y = y,
                        ts = (long)ts,
                        valid = !double.IsNaN(x) && !double.IsNaN(y)
                    };
                    string json = JsonConvert.SerializeObject(msg);
                    
                    foreach (var client in clients)
                    {
                        if (client.IsAvailable)
                        {
                            client.Send(json);
                        }
                    }
                });

                Console.WriteLine("[bridge] Ready to stream gaze data. Press Ctrl+C to exit.");
                
                // Keep the process alive
                while (true)
                {
                    System.Threading.Thread.Sleep(1000);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[bridge] Error: {ex.Message}");
                Console.WriteLine($"[bridge] Stack trace: {ex.StackTrace}");
                
                Console.WriteLine("\n[bridge] Troubleshooting suggestions:");
                Console.WriteLine("[bridge] 1. Ensure Tobii Experience or Tobii Game Hub is running");
                Console.WriteLine("[bridge] 2. Check that your Tobii device is connected and calibrated");
                Console.WriteLine("[bridge] 3. Verify that Tobii services are running in Task Manager");
                Console.WriteLine("[bridge] 4. Try running as Administrator");
                Console.WriteLine("[bridge] 5. Ensure the application is running on x64 platform");
            }
        }
    }
}
